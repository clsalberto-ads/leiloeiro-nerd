import { describe, expect, it } from "vitest";
import { cancelItem } from "./cancel-item";
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
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

class FakeItemRepository implements ItemRepository {
  constructor(private item: Item | null) {}
  async create() {
    return baseItem;
  }
  async update() {
    return this.item;
  }
  async findById() {
    return this.item;
  }
  async findBySellerId() {
    return [];
  }
  async delete() {}
  async setStatus(_: string, status: Item["status"]) {
    if (!this.item) return null;
    return { ...this.item, status };
  }
  async countBids() {
    return 0;
  }
  async findImagesByItemId() {
    return [];
  }
  async findImageById() {
    return null;
  }
  async createImages() {
    return [];
  }
  async deleteImage() {}
}

describe("cancelItem", () => {
  it("cancela item active", async () => {
    const repo = new FakeItemRepository(baseItem);
    const result = await cancelItem(repo, "u1", "i1");
    expect(result.status).toBe("cancelled");
  });

  it("cancela item closed", async () => {
    const repo = new FakeItemRepository({ ...baseItem, status: "closed" });
    const result = await cancelItem(repo, "u1", "i1");
    expect(result.status).toBe("cancelled");
  });

  it("rejeita cancelar item em draft", async () => {
    const repo = new FakeItemRepository({ ...baseItem, status: "draft" });
    await expect(cancelItem(repo, "u1", "i1")).rejects.toThrow();
  });

  it("rejeita item inexistente", async () => {
    const repo = new FakeItemRepository(null);
    await expect(cancelItem(repo, "u1", "missing")).rejects.toThrow("Item não encontrado");
  });
});
