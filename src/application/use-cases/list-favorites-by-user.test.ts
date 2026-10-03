import { describe, expect, it } from "vitest";
import { listFavoritesByUser } from "./list-favorites-by-user";
import type { Favorite, FavoriteRepository } from "@/domain/repositories/favorite-repository";

class Fake implements FavoriteRepository {
  f: Favorite[] = [];
  async toggle() { return { favorited: false, favorite: null }; }
  async isFavorite() { return false; }
  async listByUser(userId: string) { return this.f.filter(x=>x.userId===userId); }
  async countByItem() { return 0; }
}

describe("listFavoritesByUser", () => {
  it("lista favoritos do usuário", async () => {
    const repo = new Fake();
    repo.f.push({id:'f1', userId:'u1', itemId:'i1', createdAt:new Date()});
    repo.f.push({id:'f2', userId:'u2', itemId:'i2', createdAt:new Date()});
    const res = await listFavoritesByUser(repo,'u1');
    expect(res).toHaveLength(1);
    expect(res[0].itemId).toBe('i1');
  });
});
