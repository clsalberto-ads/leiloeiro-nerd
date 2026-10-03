import { Queue, Worker } from "bullmq";
import { closeExpiredItems } from "@/application/use-cases/close-expired-items";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { AUCTION_QUEUE, CLOSE_EXPIRED_EVERY_MS } from "./queue";

const CLOSE_EXPIRED_JOB = "close-expired-items";

const worker = new Worker(
  AUCTION_QUEUE,
  async (job) => {
    if (job.name !== CLOSE_EXPIRED_JOB) {
      console.log(`[worker] processando job "${job.name}":`, job.data);
      return;
    }
    // Um unico `Date` para todos os itens desta execucao: dois itens que venceram
    // no mesmo minuto caem no mesmo dia, independente de quanto o UPDATE levou.
    const encerrados = await closeExpiredItems(drizzleItemRepository, new Date());
    if (encerrados.length > 0) {
      console.log(`[worker] ${encerrados.length} item(ns) expirado(s) encerrado(s): ${encerrados.join(", ")}`);
    }
    return { encerrados: encerrados.length };
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
  // este `main()`, re-registrava o agendador e escrevia de novo. Um worker que
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
  await fila.upsertJobScheduler(
    CLOSE_EXPIRED_JOB,
    { every: CLOSE_EXPIRED_EVERY_MS },
    { name: CLOSE_EXPIRED_JOB },
  );
  console.log(
    `[worker] agendado "${CLOSE_EXPIRED_JOB}" a cada ${CLOSE_EXPIRED_EVERY_MS / 1000}s`,
  );

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
