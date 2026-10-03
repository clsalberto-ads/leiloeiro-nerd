import { and, count, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { userFavorites } from "@/infrastructure/database/schema";
import type { Favorite, FavoriteRepository } from "@/domain/repositories/favorite-repository";

export function toFavorite(row: typeof userFavorites.$inferSelect): Favorite {
  return {
    id: row.id,
    userId: row.userId,
    itemId: row.itemId,
    createdAt: row.createdAt,
  };
}

export const drizzleFavoriteRepository: FavoriteRepository = {
  async toggle(userId: string, itemId: string) {
    const existing = await db
      .select()
      .from(userFavorites)
      .where(and(eq(userFavorites.userId, userId), eq(userFavorites.itemId, itemId)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .delete(userFavorites)
        .where(and(eq(userFavorites.userId, userId), eq(userFavorites.itemId, itemId)));
      return { favorited: false, favorite: null };
    }

    const [row] = await db
      .insert(userFavorites)
      .values({ userId, itemId })
      .returning();
    return { favorited: true, favorite: row ? toFavorite(row) : null };
  },

  async isFavorite(userId: string, itemId: string) {
    const [row] = await db
      .select({ id: userFavorites.id })
      .from(userFavorites)
      .where(and(eq(userFavorites.userId, userId), eq(userFavorites.itemId, itemId)))
      .limit(1);
    return Boolean(row);
  },

  async listByUser(userId: string) {
    const rows = await db
      .select()
      .from(userFavorites)
      .where(eq(userFavorites.userId, userId))
      .orderBy(userFavorites.createdAt);
    return rows.map(toFavorite);
  },

  async countByItem(itemId: string) {
    const [row] = await db
      .select({ total: count() })
      .from(userFavorites)
      .where(eq(userFavorites.itemId, itemId));
    return Number(row?.total ?? 0);
  },
};
