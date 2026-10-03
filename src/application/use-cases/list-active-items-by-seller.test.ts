import { describe, expect, it } from "vitest";
import { listActiveItemsBySellerId } from "./list-active-items-by-seller";
import type { Item, ItemListFilter, ItemRepository } from "@/domain/repositories/item-repository";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "i1",
    sellerId: "u1",
    title: "Item",
    description: "",
    type: "product",
    imageUrl: null,
    minInitialBid: 100,
    minBidIncrement: 100,
    bidDeadline: new Date(),
    paymentDeadlineDays: 3,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

class FakeItemRepository implements ItemRepository {
  async closeExpired() {
    return [];
  }
  async updateDraft(): Promise<Item | null> {
    throw new Error("não usado");
  }
  calls: { sellerId: string; filter?: ItemListFilter }[] = [];
  constructor(private rows: Item[]) {}
  async findBySellerId(sellerId: string, filter?: ItemListFilter) {
    this.calls.push({ sellerId, filter });
    return this.rows;
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
  createImages() {
    return Promise.reject(new Error("não usado"));
  }
  deleteImage() {
    return Promise.reject(new Error("não usado"));
  }
}

describe("listActiveItemsBySellerId", () => {
  it("filtra por status active e repassa o sellerId", async () => {
    const repo = new FakeItemRepository([]);
    await listActiveItemsBySellerId(repo, "u1");
    expect(repo.calls).toEqual([{ sellerId: "u1", filter: { status: "active" } }]);
  });

  it("retorna os itens ativos encontrados", async () => {
    const rows = [makeItem(), makeItem({ id: "i2", status: "closed" })];
    const repo = new FakeItemRepository(rows);
    await expect(listActiveItemsBySellerId(repo, "u1")).resolves.toEqual(rows);
  });

  it("retorna lista vazia quando não há itens ativos", async () => {
    await expect(listActiveItemsBySellerId(new FakeItemRepository([]), "u1")).resolves.toEqual([]);
  });
});