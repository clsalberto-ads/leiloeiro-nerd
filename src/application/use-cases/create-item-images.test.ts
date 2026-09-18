import { describe, expect, it } from "vitest";
import { createItemImages } from "./create-item-images";
import type { ItemImage, ItemRepository } from "@/domain/repositories/item-repository";

class FakeItemRepository implements ItemRepository {
  calls: { itemId: string; urls: string[] }[] = [];
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