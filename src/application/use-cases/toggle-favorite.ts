import type { FavoriteRepository } from "@/domain/repositories/favorite-repository";

export async function toggleFavorite(
  favoriteRepo: FavoriteRepository,
  userId: string,
  itemId: string,
) {
  return favoriteRepo.toggle(userId, itemId);
}
