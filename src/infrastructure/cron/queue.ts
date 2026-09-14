import { Queue } from "bullmq";

export const AUCTION_QUEUE = "auction-jobs";

export function auctionQueue(): Queue {
  return new Queue(AUCTION_QUEUE, { connection: { url: process.env.REDIS_URL } });
}