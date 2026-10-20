import { Queue, Worker } from "bullmq";
import { closeExpiredItems } from "@/application/use-cases/close-expired-items";
import { createPayment } from "@/application/use-cases/create-payment";
import { verificarPrazos, sincronizarMp } from "@/application/use-cases/verificar-prazos";
import { handlePaymentWebhook } from "@/application/use-cases/handle-payment-webhook";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { createPaymentDeps } from "@/infrastructure/payments/create-payment-deps";
import { getMpPayment } from "@/infrastructure/mercado-pago/payments";
import {
  AUCTION_QUEUE,
  CLOSE_EXPIRED_EVERY_MS,
  VERIFICAR_PRAZOS_EVERY_MS,
  SINCRONIZAR_MP_EVERY_MS,
} from "./queue";

const CLOSE_EXPIRED_JOB = "close-expired-items";
const VERIFICAR_PRAZOS_JOB = "verificar-prazos";
const SINCRONIZAR_MP_JOB = "sincronizar-mp";

const worker = new Worker(
  AUCTION_QUEUE,
  async (job) => {
    // Um unico `Date` por execucao: o instante e o mesmo para todos os itens
    // do lote, independente de quanto o primeiro levou.
    const now = new Date();

    if (job.name === VERIFICAR_PRAZOS_JOB) {
      // Cascata + vencimento. `verificarPrazos` ja e best-effort por item.
      const resultado = await verificarPrazos(createPaymentDeps(), now);
      if (resultado.expired || resultado.cascaded || resultado.cancelledItems) {
        console.log(
          `[worker] verificar-prazos: ${resultado.expired} vencido(s), ` +
            `${resultado.cascaded} cascata(s), ${resultado.cancelledItems} item(ns) cancelado(s)`,
        );
      }
      return resultado;
    }

    if (job.name === SINCRONIZAR_MP_JOB) {
      // Rede de seguranca do webhook: reusa o handler inteiro (que nunca
      // dispara cascata — o unico gatilho dela e o verificar-prazos).
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
    }

    if (job.name !== CLOSE_EXPIRED_JOB) {
      console.log(`[worker] processando job "${job.name}":`, job.data);
      return;
    }

    const encerrados = await closeExpiredItems(drizzleItemRepository, now);
    if (encerrados.length > 0) {
      console.log(`[worker] ${encerrados.length} item(ns) expirado(s) encerrado(s): ${encerrados.join(", ")}`);
    }

    // ponytail: a cobranca do arremate e GERADA aqui, no mesmo job do
    // encerramento — a spec nao deixa o item encerrado esperar um segundo
    // gatilho para o vencedor poder pagar. Best-effort POR ITEM: um item cujo
    // vendedor ainda nao conectou a conta MP (ou cuja chamada falhou) nao pode
    // impedir os outros de receberem cobranca — o erro e logado e o proximo
    // ciclo (ou o botao "gerar cobranca" do vendedor) recupera, porque o
    // `createPayment` e idempotente.
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
  { connection: { url: process.env.REDIS_URL } },
);

worker.on("ready", () => console.log("[worker] BullMQ worker conectado ao Redis"));
worker.on("failed", (job, err) => console.error(`[worker] falha no job ${job?.id}`, err));

// ponytail: o `upsertJobScheduler` roda no START do worker e nao num cron externo
// (cron do SO, Kubernetes CronJob, Vercel Cron). Um agendador declarativo
// registraria o MESMO job toda vez que subisse outra replica; o
// `upsertJobScheduler` deduplica pelo par `jobId` + `every`, entao N replicas
// continuam sendo N execucoes por janela — o que se quer para um UPDATE
// idempotente — e nao ha nenhuma configuracao fora do repositorio para lembrar. O
// `jobId` estavel e o que faz a deduplicacao valer entre deploys.
//
// E por isso que isto NAO e `await` no topo do arquivo: este arquivo roda por
// `tsx watch`, fora do bundler do Next, e o `package.json` nao declara
// `"type": "module"`. O `tsc --noEmit` passa (o `module: esnext` do tsconfig
// permite top-level await) e mesmo assim o `node` recusa em CommonJS — um
// gate que nao pegaria. Entao tudo que precisa esperar mora aqui dentro.
async function main(): Promise<void> {
  // ponytail: falha alto e logo, em vez de deixar o BullMQ e o drizzle caírem no
  // `localhost:6379` / no banco local sem dizer nada. O `watch` que este script
  // usava antes tornava isso pior a cada save: reiniciar o worker reexecutava
  // este `main()`, re-registrava o agendador e escreveu de novo. Um worker que
  // "funciona" apontando para o banco errado é o pior modo de falha possível
  // aqui — ele encerra itens de verdade e reporta sucesso no console.
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL ausente: o worker fecharia itens de expirados no Redis local");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente: o worker fecharia itens no banco local");

  // O host no log e o que permite enxergar o alvo antes do primeiro `UPDATE`.
  const host = (url: string) => new URL(url).host;
  console.log(
    `[worker] alvo: redis=${host(redisUrl)} banco=${host(process.env.DATABASE_URL)} ` +
      `| expirados a cada ${CLOSE_EXPIRED_EVERY_MS / 1000}s`,
  );

  const fila = new Queue(AUCTION_QUEUE, { connection: { url: redisUrl } });
  for (const [nome, every] of [
    [CLOSE_EXPIRED_JOB, CLOSE_EXPIRED_EVERY_MS],
    [VERIFICAR_PRAZOS_JOB, VERIFICAR_PRAZOS_EVERY_MS],
    [SINCRONIZAR_MP_JOB, SINCRONIZAR_MP_EVERY_MS],
  ] as const) {
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
