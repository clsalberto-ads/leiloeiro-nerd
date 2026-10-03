import { describe, expect, it } from "vitest";
import { toggleFavorite } from "./toggle-favorite";
import type { Favorite, FavoriteRepository } from "@/domain/repositories/favorite-repository";

class FakeFavoriteRepository implements FavoriteRepository {
  favorites: Favorite[] = [];
  async toggle(userId: string, itemId: string) {
    const idx = this.favorites.findIndex((f) => f.userId === userId && f.itemId === itemId);
    if (idx >= 0) {
      this.favorites.splice(idx, 1);
      return { favorited: false, favorite: null };
    }
    const fav: Favorite = {
      id: `fav-${this.favorites.length + 1}`,
      userId,
      itemId,
      createdAt: new Date(),
    };
    this.favorites.push(fav);
    return { favorited: true, favorite: fav };
  }
  async isFavorite(userId: string, itemId: string) {
    return this.favorites.some((f) => f.userId === userId && f.itemId === itemId);
  }
  async listByUser(userId: string) {
    return this.favorites.filter((f) => f.userId === userId);
  }
  async countByItem(itemId: string) {
    return this.favorites.filter((f) => f.itemId === itemId).length;
  }
}

describe("toggleFavorite", () => {
  it("adiciona favorito quando não existe", async () => {
    const repo = new FakeFavoriteRepository();
    const res = await toggleFavorite(repo, "u1", "i1");
    expect(res.favorited).toBe(true);
    expect(res.favorite?.itemId).toBe("i1");
  });

  it("remove favorito quando já existe", async () => {
    const repo = new FakeFavoriteRepository();
    await toggleFavorite(repo, "u1", "i1");
    const res = await toggleFavorite(repo, "u1", "i1");
    expect(res.favorited).toBe(false);
    expect(res.favorite).toBeNull();
  });
});
