import { describe, expect, it } from "vitest";
import { deleteItem } from "./delete-item";
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
  constructor(private item: Item | null, private bidCount = 0, public deleted: string[] = []) {}
  async create() {
    return baseItem;
  }
  async findById() {
    return this.item;
  }
  async findBySellerId() {
    return [];
  }
  async delete(id: string) {
    this.deleted.push(id);
  }
  async closeExpired() {
    return [];
  }
  async updateDraft(): Promise<Item | null> {
    throw new Error("não usado");
  }

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
  async createImages() {
    return [];
  }
  async deleteImage() {}
}

describe("deleteItem", () => {
  it("deleta item em draft sem lances", async () => {
    const repo = new FakeItemRepository(baseItem);
    await deleteItem(repo, "u1", "i1");
    expect(repo.deleted).toEqual(["i1"]);
  });

  it("rejeita item publicado", async () => {
    const repo = new FakeItemRepository({ ...baseItem, status: "active" });
    await expect(deleteItem(repo, "u1", "i1")).rejects.toThrow("Apenas itens em rascunho podem ser excluídos");
    expect(repo.deleted).toEqual([]);
  });

  it("rejeita item com lances", async () => {
    const repo = new FakeItemRepository(baseItem, 1);
    await expect(deleteItem(repo, "u1", "i1")).rejects.toThrow("Item com lances não pode ser excluído");
    expect(repo.deleted).toEqual([]);
  });

  it("rejeita item inexistente", async () => {
    const repo = new FakeItemRepository(null);
    await expect(deleteItem(repo, "u1", "missing")).rejects.toThrow("Item não encontrado");
  });

  it("rejeita sem permissão", async () => {
    const repo = new FakeItemRepository(baseItem);
    await expect(deleteItem(repo, "u2", "i1")).rejects.toThrow("Sem permissão");
  });
});
