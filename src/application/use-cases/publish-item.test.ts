import { describe, expect, it } from "vitest";
import { publishItem } from "./publish-item";
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
  constructor(private item: Item | null, public statuses: Item["status"][] = []) {}
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
    this.statuses.push(status);
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

describe("publishItem", () => {
  it("transiciona draft para active", async () => {
    const repo = new FakeItemRepository(baseItem);
    const result = await publishItem(repo, "u1", "i1");
    expect(result.status).toBe("active");
    expect(repo.statuses).toEqual(["active"]);
  });

  it("rejeita item já publicado", async () => {
    const repo = new FakeItemRepository({ ...baseItem, status: "active" });
    await expect(publishItem(repo, "u1", "i1")).rejects.toThrow("Item já publicado");
  });

  it("rejeita item inexistente", async () => {
    const repo = new FakeItemRepository(null);
    await expect(publishItem(repo, "u1", "missing")).rejects.toThrow("Item não encontrado");
  });

  it("rejeita sem permissão", async () => {
    const repo = new FakeItemRepository(baseItem);
    await expect(publishItem(repo, "u2", "i1")).rejects.toThrow("Sem permissão");
  });

  it("rejeita item cujo prazo de lances já passou", async () => {
    const repo = new FakeItemRepository({
      ...baseItem,
      bidDeadline: new Date(Date.now() - 1000),
    });
    await expect(publishItem(repo, "u1", "i1")).rejects.toThrow("Prazo de lances já passou");
    expect(repo.statuses).toEqual([]);
  });
});
