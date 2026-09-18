import { describe, expect, it } from "vitest";
import { updateItem } from "./update-item";
import type { Item, ItemRepository } from "@/domain/repositories/item-repository";

const baseItem: Item = {
  id: "i1",
  sellerId: "u1",
  title: "Action Figure rara",
  description: "Colecionável lacrado, edição limitada.",
  type: "product",
  imageUrl: null,
  minInitialBid: 5000,
  minBidIncrement: 500,
  bidDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  paymentDeadlineDays: 3,
  status: "draft",
  createdAt: new Date(),
  updatedAt: new Date(),
};

class FakeItemRepository implements ItemRepository {
  imagesCaptures: { itemId: string; urls: string[] }[] = [];
  constructor(private item: Item | null, private bidCount = 0) {}
  async create() {
    return baseItem;
  }
  async update(_: string, input: Partial<Item>) {
    if (!this.item) return null;
    this.item = { ...this.item, ...input };
    return this.item;
  }
  async findById() {
    return this.item;
  }
  async findBySellerId() {
    return [];
  }
  async delete() {}
  async setStatus() {
    return this.item;
  }
  async countBids() {
    return this.bidCount;
  }
  async findImagesByItemId() {
    return [];
  }
  async findImageById() {
    return null;
  }
  async createImages(itemId: string, urls: string[]) {
    this.imagesCaptures.push({ itemId, urls });
    return [];
  }
  async deleteImage() {}
}

describe("updateItem", () => {
  it("permite atualizar item em draft", async () => {
    const repo = new FakeItemRepository(baseItem);
    const result = await updateItem(repo, "u1", "i1", { title: "Novo título" });
    expect(result.title).toBe("Novo título");
  });

  it("bloqueia edição de item publicado", async () => {
    const repo = new FakeItemRepository({ ...baseItem, status: "active" });
    await expect(updateItem(repo, "u1", "i1", { title: "X" })).rejects.toThrow("Item publicado não pode ser editado");
  });

  it("bloqueia edição quando há lances", async () => {
    const repo = new FakeItemRepository(baseItem, 1);
    await expect(updateItem(repo, "u1", "i1", { title: "X" })).rejects.toThrow("Item com lances não pode ser editado");
  });

  it("lança erro se item não existe", async () => {
    const repo = new FakeItemRepository(null);
    await expect(updateItem(repo, "u1", "missing", { title: "X" })).rejects.toThrow("Item não encontrado");
  });

  it("lança erro sem permissão", async () => {
    const repo = new FakeItemRepository(baseItem);
    await expect(updateItem(repo, "u2", "i1", { title: "X" })).rejects.toThrow("Sem permissão");
  });

  it("adiciona imageUrls ao repositório quando fornecidas", async () => {
    const repo = new FakeItemRepository(baseItem);
    await updateItem(repo, "u1", "i1", { title: "Novo título", imageUrls: ["https://ex.com/a.jpg"] });
    expect(repo.imagesCaptures).toEqual([{ itemId: "i1", urls: ["https://ex.com/a.jpg"] }]);
  });

  it("não chama createImages sem imageUrls", async () => {
    const repo = new FakeItemRepository(baseItem);
    await updateItem(repo, "u1", "i1", { title: "Novo título" });
    expect(repo.imagesCaptures).toEqual([]);
  });
});