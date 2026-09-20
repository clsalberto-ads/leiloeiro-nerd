import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { bids, items } from "@/infrastructure/database/schema";
import type { Bid, BidRepository, CreateBidInput } from "@/domain/repositories/bid-repository";

export function nextRank(highestRank: number | null): number {
  return (highestRank ?? 0) + 1;
}

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

  async placeBid(input: CreateBidInput, validate) {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM ${items} WHERE id = ${input.itemId} FOR UPDATE`);

      const [itemRow] = await tx
        .select({
          id: items.id,
          title: items.title,
          sellerId: items.sellerId,
          status: items.status,
          bidDeadline: items.bidDeadline,
          minInitialBid: items.minInitialBid,
          minBidIncrement: items.minBidIncrement,
        })
        .from(items)
        .where(eq(items.id, input.itemId));

      const [highestRow] = await tx
        .select({
          id: bids.id,
          bidderId: bids.bidderId,
          amount: bids.amount,
          rank: bids.rank,
          createdAt: bids.createdAt,
        })
        .from(bids)
        .where(eq(bids.itemId, input.itemId))
        .orderBy(desc(bids.amount))
        .limit(1);

      const highestBid: Bid | undefined = highestRow
        ? { ...highestRow, itemId: input.itemId, bidderName: highestRow.bidderId }
        : undefined;

      validate({
        item: itemRow
          ? {
              id: itemRow.id,
              title: itemRow.title,
              sellerId: itemRow.sellerId,
              status: itemRow.status,
              bidDeadline: itemRow.bidDeadline,
              minInitialBid: itemRow.minInitialBid,
              minBidIncrement: itemRow.minBidIncrement,
            }
          : null,
        highestBid,
      });

      const rank = nextRank(highestRow?.rank ?? null);

      const [row] = await tx
        .insert(bids)
        .values({ ...input, rank })
        .returning();

      return {
        bid: {
          id: row.id,
          itemId: row.itemId,
          bidderId: row.bidderId,
          bidderName: row.bidderId,
          amount: row.amount,
          rank: row.rank,
          createdAt: row.createdAt,
        } satisfies Bid,
        previousHighestBid: highestBid ?? null,
      };
    });
  },
};