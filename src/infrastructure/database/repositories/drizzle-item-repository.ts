import { type InferSelectModel } from "drizzle-orm";
import { and, count, desc, eq, max, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { bids, itemImages, items } from "@/infrastructure/database/schema";
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
        updatedAt: new Date(),
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
      .set({ status, updatedAt: new Date() })
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

  async findImagesByItemId(itemId) {
    const rows = await db
      .select()
      .from(itemImages)
      .where(eq(itemImages.itemId, itemId))
      .orderBy(itemImages.position);
    return rows.map((r) => ({ id: r.id, itemId: r.itemId, url: r.url, position: r.position, createdAt: r.createdAt }));
  },

  async findImageById(imageId) {
    const [row] = await db.select().from(itemImages).where(eq(itemImages.id, imageId)).limit(1);
    return row
      ? { id: row.id, itemId: row.itemId, url: row.url, position: row.position, createdAt: row.createdAt }
      : null;
  },

  async createImages(itemId, urls) {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select({ maxPos: max(itemImages.position) })
        .from(itemImages)
        .where(eq(itemImages.itemId, itemId));
      const start = existing[0]?.maxPos ?? -1;
      const values = urls.map((url, i) => ({ itemId, url, position: start + 1 + i }));
      const rows = await tx.insert(itemImages).values(values).returning();
      await tx
        .update(items)
        .set({
          imageUrl: sql`(select url from ${itemImages} where ${itemImages.itemId} = ${itemId} order by position asc limit 1)`,
          updatedAt: new Date(),
        })
        .where(eq(items.id, itemId));
      return rows.map((r) => ({ id: r.id, itemId: r.itemId, url: r.url, position: r.position, createdAt: r.createdAt }));
    });
  },

  async deleteImage(imageId) {
    const [row] = await db.select().from(itemImages).where(eq(itemImages.id, imageId)).limit(1);
    await db.delete(itemImages).where(eq(itemImages.id, imageId));
    if (row) {
      await db
        .update(items)
        .set({
          imageUrl: sql`(select url from ${itemImages} where ${itemImages.itemId} = ${row.itemId} order by position asc limit 1)`,
          updatedAt: new Date(),
        })
        .where(eq(items.id, row.itemId));
    }
  },
};
