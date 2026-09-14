import { auctionQueue } from "../src/infrastructure/cron/queue";

async function main() {
  const q = auctionQueue();
  await q.add("smoke", { at: new Date().toISOString() });
  console.log("Job added");
  await q.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});