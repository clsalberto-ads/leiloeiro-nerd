import type { FavoriteRepository } from "@/domain/repositories/favorite-repository";

export async function listFavoritesByUser(
  favoriteRepo: FavoriteRepository,
  userId: string,
) {
  return favoriteRepo.listByUser(userId);
}
