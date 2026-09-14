import { Worker } from "bullmq";
import { AUCTION_QUEUE } from "./queue";

const worker = new Worker(
  AUCTION_QUEUE,
  async (job) => {
    console.log(`[worker] processando job "${job.name}":`, job.data);
  },
  { connection: { url: process.env.REDIS_URL } },
);

worker.on("ready", () => console.log("[worker] BullMQ worker conectado ao Redis"));
worker.on("failed", (job, err) => console.error(`[worker] falha no job ${job?.id}`, err));

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});