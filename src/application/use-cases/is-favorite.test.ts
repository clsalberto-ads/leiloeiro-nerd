import { describe, expect, it } from "vitest";
import { isFavorite } from "./is-favorite";
import type { Favorite, FavoriteRepository } from "@/domain/repositories/favorite-repository";

class Fake implements FavoriteRepository {
  f: Favorite[] = [];
  async toggle() { return { favorited: false, favorite: null }; }
  async isFavorite(userId: string, itemId: string) { return this.f.some(x=>x.userId===userId&&x.itemId===itemId); }
  async listByUser() { return []; }
  async countByItem() { return 0; }
}

describe("isFavorite", () => {
  it("retorna true/false corretamente", async () => {
    const repo = new Fake();
    repo.f.push({id:'f1', userId:'u1', itemId:'i1', createdAt:new Date()});
    expect(await isFavorite(repo,'u1','i1')).toBe(true);
    expect(await isFavorite(repo,'u1','i2')).toBe(false);
  });
});
