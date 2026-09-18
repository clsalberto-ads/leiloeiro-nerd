import { desc, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { bids } from "@/infrastructure/database/schema";
import type { BidRepository } from "@/domain/repositories/bid-repository";

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
    // bidderName via join com user — simplificado: retorna bidderId, nome resolvido no use case
    return rows.map((r) => ({ ...r, bidderName: r.bidderId }));
  },
};