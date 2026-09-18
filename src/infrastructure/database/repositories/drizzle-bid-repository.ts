import { desc, eq, max, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { bids, items } from "@/infrastructure/database/schema";
import type { BidRepository, CreateBidInput } from "@/domain/repositories/bid-repository";

export const drizzleBidRepository: BidRepository = {
  async findByItemId(itemId) {
    const rows = await db
      .select({
        id: bids.id,
        itemId: bids.itemId,
        bidderId: bids.bidderId,
        amount: bids.amount,
        rank: bids.rank,
        createdAt: bids.createdAt,
      })
      .from(bids)
      .where(eq(bids.itemId, itemId))
      .orderBy(desc(bids.amount));
    return rows.map((r) => ({ ...r, bidderName: r.bidderId }));
  },

  async createBid(input: CreateBidInput) {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM ${items} WHERE id = ${input.itemId} FOR UPDATE`);

      const existingMaxRank = await tx
        .select({ maxRank: max(bids.rank) })
        .from(bids)
        .where(eq(bids.itemId, input.itemId));

      const rank = (existingMaxRank[0]?.maxRank ?? 0) + 1;

      const [row] = await tx
        .insert(bids)
        .values({ ...input, rank })
        .returning();

      return {
        id: row.id,
        itemId: row.itemId,
        bidderId: row.bidderId,
        bidderName: row.bidderId,
        amount: row.amount,
        rank: row.rank,
        createdAt: row.createdAt,
      };
    });
  },
};