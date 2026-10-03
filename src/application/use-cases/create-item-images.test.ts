import { describe, expect, it } from "vitest";
import { createItemImages } from "./create-item-images";
import type { Item, ItemImage, ItemRepository } from "@/domain/repositories/item-repository";

class CumulativeFakeItemRepository implements ItemRepository {
  async closeExpired() {
    return [];
  }
  async updateDraft(): Promise<Item | null> {
    throw new Error("não usado");
  }
  positions: number[] = [];
  async createImages(itemId: string, urls: string[]) {
    const start = this.positions[this.positions.length - 1] ?? -1;
    this.positions.push(...urls.map((_, i) => start + 1 + i));
    const base = this.positions.length - urls.length;
    return urls.map((url, i) => ({
      id: `img-${base + i}`,
      itemId,
      url,
      position: base + i,
      createdAt: new Date(),
    })) satisfies ItemImage[];
  }
  get allPositions() {
    return this.positions;
  }
  create() {
    return Promise.reject(new Error("não usado"));
  }
  update() {
    return Promise.reject(new Error("não usado"));
  }
  findById() {
    return Promise.reject(new Error("não usado"));
  }
  findBySellerId() {
    return Promise.reject(new Error("não usado"));
  }
  delete() {
    return Promise.reject(new Error("não usado"));
  }
  setStatus() {
    return Promise.reject(new Error("não usado"));
  }
  countBids() {
    return Promise.reject(new Error("não usado"));
  }
  findImagesByItemId() {
    return Promise.reject(new Error("não usado"));
  }
  findImageById() {
    return Promise.reject(new Error("não usado"));
  }
  deleteImage() {
    return Promise.reject(new Error("não usado"));
  }
}

class FakeItemRepository implements ItemRepository {
  async closeExpired() {
    return [];
  }
  calls: { itemId: string; urls: string[] }[] = [];

  async updateDraft(): Promise<Item | null> {
    throw new Error("não usado");
  }
  async createImages(itemId: string, urls: string[]) {
    this.calls.push({ itemId, urls });
    return urls.map((url, position) => ({
      id: `img-${position}`,
      itemId,
      url,
      position,
      createdAt: new Date(),
    })) satisfies ItemImage[];
  }
  create() {
    return Promise.reject(new Error("não usado"));
  }
  update() {
    return Promise.reject(new Error("não usado"));
  }
  findById() {
    return Promise.reject(new Error("não usado"));
  }
  findBySellerId() {
    return Promise.reject(new Error("não usado"));
  }
  delete() {
    return Promise.reject(new Error("não usado"));
  }
  setStatus() {
    return Promise.reject(new Error("não usado"));
  }
  countBids() {
    return Promise.reject(new Error("não usado"));
  }
  findImagesByItemId() {
    return Promise.reject(new Error("não usado"));
  }
  async findImageById() {
    return null;
  }
  deleteImage() {
    return Promise.reject(new Error("não usado"));
  }
}

describe("createItemImages", () => {
  it("persiste imagens com posições 0..N", async () => {
    const repo = new FakeItemRepository();
    const result = await createItemImages(repo, "i1", ["/a.jpg", "/b.jpg", "/c.jpg"]);
    expect(result.map((img) => [img.url, img.position])).toEqual([
      ["/a.jpg", 0],
      ["/b.jpg", 1],
      ["/c.jpg", 2],
    ]);
  });

  it("continua as posições após um batch anterior (chamadas aditivas)", async () => {
    const repo = new CumulativeFakeItemRepository();
    await createItemImages(repo, "i1", ["/a.jpg", "/b.jpg", "/c.jpg"]);
    const second = await createItemImages(repo, "i1", ["/d.jpg", "/e.jpg", "/f.jpg"]);
    expect(repo.allPositions).toEqual([0, 1, 2, 3, 4, 5]);
    expect(second.map((img) => img.position)).toEqual([3, 4, 5]);
  });

  it("repassa o itemId e as urls", async () => {
    const repo = new FakeItemRepository();
    await createItemImages(repo, "i1", ["/a.jpg"]);
    expect(repo.calls).toEqual([{ itemId: "i1", urls: ["/a.jpg"] }]);
  });

  it("retorna lista vazia quando não há urls", async () => {
    const repo = new FakeItemRepository();
    await expect(createItemImages(repo, "i1", [])).resolves.toEqual([]);
  });
});