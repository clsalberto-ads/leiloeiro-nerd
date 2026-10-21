import { Queue, Worker } from "bullmq";
import { closeExpiredItems } from "@/application/use-cases/close-expired-items";
import { createPayment } from "@/application/use-cases/create-payment";
import { verificarPrazos, sincronizarMp } from "@/application/use-cases/verificar-prazos";
import { handlePaymentWebhook } from "@/application/use-cases/handle-payment-webhook";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { createPaymentDeps } from "@/infrastructure/payments/create-payment-deps";
import { drizzleMpSellerAccountRepository } from "@/infrastructure/database/repositories/drizzle-mp-seller-account-repository";
import { getMpPayment } from "@/infrastructure/mercado-pago/payments";
import {
  AUCTION_QUEUE,
  CLOSE_EXPIRED_EVERY_MS,
  VERIFICAR_PRAZOS_EVERY_MS,
  SINCRONIZAR_MP_EVERY_MS,
} from "./queue";

// ponytail (R1.6): registry de jobs — cada `if (job.name === ...)` que vivia
// no handler virou UMA entrada neste mapa. Um job novo entra AQUI (uma linha
// de configuração + uma função) e não editando o mesmo bloco de 90 linhas.
// O scheduler e o handler percorrem a MESMA fonte — não há como o nome
// agendado divergir do nome processado.
const CLOSE_EXPIRED_JOB = "close-expired-items";
const VERIFICAR_PRAZOS_JOB = "verificar-prazos";
const SINCRONIZAR_MP_JOB = "sincronizar-mp";

type JobHandler = (now: Date) => Promise<unknown>;

const JOBS: Record<string, { every: number; run: JobHandler }> = {
  [CLOSE_EXPIRED_JOB]: {
    every: CLOSE_EXPIRED_EVERY_MS,
    async run(now) {
      const encerrados = await closeExpiredItems(drizzleItemRepository, now);
      if (encerrados.length > 0) {
        console.log(`[worker] ${encerrados.length} item(ns) expirado(s) encerrado(s): ${encerrados.join(", ")}`);
      }
      // A cobrança do arremate e GERADA no mesmo job do encerramento — a spec
      // não deixa o item encerrado esperar um segundo gatilho.
      let cobrancas = 0;
      const paymentDeps = createPaymentDeps();
      for (const itemId of encerrados) {
        try {
          await createPayment(paymentDeps, itemId, now);
          cobrancas += 1;
        } catch (err) {
          console.error(`[worker] falha ao gerar cobranca do item ${itemId}:`, err);
        }
      }
      return { encerrados: encerrados.length, cobrancas };
    },
  },
  [VERIFICAR_PRAZOS_JOB]: {
    every: VERIFICAR_PRAZOS_EVERY_MS,
    async run(now) {
      const resultado = await verificarPrazos(createPaymentDeps(), now);
      if (resultado.expired || resultado.cascaded || resultado.cancelledItems) {
        console.log(
          `[worker] verificar-prazos: ${resultado.expired} vencido(s), ` +
            `${resultado.cascaded} cascata(s), ${resultado.cancelledItems} item(ns) cancelado(s)`,
        );
      }
      return resultado;
    },
  },
  [SINCRONIZAR_MP_JOB]: {
    every: SINCRONIZAR_MP_EVERY_MS,
    async run(now) {
      const deps = createPaymentDeps();
      const resultado = await sincronizarMp(
        {
          paymentRepo: deps.paymentRepo,
          handleWebhook: (mpPaymentId) =>
            handlePaymentWebhook(
              {
                paymentRepo: deps.paymentRepo,
                itemRepo: deps.itemRepo,
                notifRepo: deps.notifRepo,
                getAccessToken: deps.getAccessToken,
                fetchStatus: { fetchMpPaymentStatus: getMpPayment },
                resend: deps.resend,
                userRepo: deps.userRepo,
                connectedSellerIds: () =>
                  drizzleMpSellerAccountRepository.listUserIds(),
              },
              mpPaymentId,
            ),
        },
        now,
      );
      if (resultado.checked > 0) {
        console.log(`[worker] sincronizar-mp: ${resultado.checked} pagamento(ns) reconciliado(s)`);
      }
      return resultado;
    },
  },
};

const worker = new Worker(
  AUCTION_QUEUE,
  async (job) => {
    const handler = JOBS[job.name];
    if (!handler) {
      console.log(`[worker] job desconhecido "${job.name}":`, job.data);
      return;
    }
    const now = new Date();
    return handler.run(now);
  },
  { connection: { url: process.env.REDIS_URL } },
);

worker.on("ready", () => console.log("[worker] BullMQ worker conectado ao Redis"));
worker.on("failed", (job, err) => console.error(`[worker] falha no job ${job?.id}`, err));

async function main(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL ausente: o worker fecharia itens de expirados no Redis local");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente: o worker fecharia itens no banco local");

  const host = (url: string) => new URL(url).host;
  console.log(`[worker] alvo: redis=${host(redisUrl)} banco=${host(process.env.DATABASE_URL)}`);

  const fila = new Queue(AUCTION_QUEUE, { connection: { url: redisUrl } });
  for (const [nome, { every }] of Object.entries(JOBS)) {
    await fila.upsertJobScheduler(nome, { every }, { name: nome });
    console.log(`[worker] agendado "${nome}" a cada ${every / 1000}s`);
  }

  process.on("SIGTERM", async () => {
    await worker.close();
    await fila.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[worker] falha ao iniciar", err);
  process.exit(1);
});
