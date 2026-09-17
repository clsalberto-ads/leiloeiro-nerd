import { type InferSelectModel } from "drizzle-orm";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { bids, items } from "@/infrastructure/database/schema";
import type { CreateItemInput, Item, ItemRepository } from "@/domain/repositories/item-repository";

type ItemRow = InferSelectModel<typeof items>;

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    sellerId: row.sellerId,
    title: row.title,
    description: row.description,
    type: row.type,
    imageUrl: row.imageUrl,
    minInitialBid: row.minInitialBid,
    minBidIncrement: row.minBidIncrement,
    bidDeadline: row.bidDeadline,
    paymentDeadlineDays: row.paymentDeadlineDays,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const drizzleItemRepository: ItemRepository = {
  async create(input: CreateItemInput) {
    const [row] = await db
      .insert(items)
      .values({
        sellerId: input.sellerId,
        title: input.title,
        description: input.description,
        type: input.type,
        minInitialBid: input.minInitialBid,
        minBidIncrement: input.minBidIncrement,
        bidDeadline: input.bidDeadline,
        paymentDeadlineDays: input.paymentDeadlineDays,
      })
      .returning();
    return toItem(row!);
  },

  async update(id, input) {
    const [row] = await db
      .update(items)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.minInitialBid !== undefined ? { minInitialBid: input.minInitialBid } : {}),
        ...(input.minBidIncrement !== undefined ? { minBidIncrement: input.minBidIncrement } : {}),
        ...(input.bidDeadline !== undefined ? { bidDeadline: input.bidDeadline } : {}),
        ...(input.paymentDeadlineDays !== undefined ? { paymentDeadlineDays: input.paymentDeadlineDays } : {}),
      })
      .where(eq(items.id, id))
      .returning();
    return row ? toItem(row) : null;
  },

  async findById(id) {
    const [row] = await db.select().from(items).where(eq(items.id, id)).limit(1);
    return row ? toItem(row) : null;
  },

  async findBySellerId(sellerId, filter) {
    const conditions = [eq(items.sellerId, sellerId)];
    if (filter?.status) conditions.push(eq(items.status, filter.status));
    const rows = await db
      .select()
      .from(items)
      .where(and(...conditions))
      .orderBy(desc(items.createdAt));
    return rows.map(toItem);
  },

  async delete(id) {
    await db.delete(items).where(eq(items.id, id));
  },

  async setStatus(id, status) {
    const [row] = await db
      .update(items)
      .set({ status })
      .where(eq(items.id, id))
      .returning();
    return row ? toItem(row) : null;
  },

  async countBids(itemId) {
    const [row] = await db
      .select({ n: count() })
      .from(bids)
      .where(eq(bids.itemId, itemId));
    return row?.n ?? 0;
  },
};
