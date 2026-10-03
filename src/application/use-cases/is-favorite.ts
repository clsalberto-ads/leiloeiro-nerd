import type { FavoriteRepository } from "@/domain/repositories/favorite-repository";

export async function isFavorite(
  favoriteRepo: FavoriteRepository,
  userId: string,
  itemId: string,
) {
  return favoriteRepo.isFavorite(userId, itemId);
}
