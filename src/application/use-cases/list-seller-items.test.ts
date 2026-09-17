import { describe, expect, it } from "vitest";
import { listSellerItems } from "./list-seller-items";
import type { Item, ItemRepository } from "@/domain/repositories/item-repository";

const items: Item[] = [
  { id: "i1", sellerId: "u1", title: "A", description: "a", type: "product", imageUrl: null, minInitialBid: 100, minBidIncrement: 100, bidDeadline: new Date(), paymentDeadlineDays: 3, status: "draft", createdAt: new Date(), updatedAt: new Date() },
  { id: "i2", sellerId: "u1", title: "B", description: "b", type: "service", imageUrl: null, minInitialBid: 100, minBidIncrement: 100, bidDeadline: new Date(), paymentDeadlineDays: 3, status: "active", createdAt: new Date(), updatedAt: new Date() },
];

class FakeItemRepository implements ItemRepository {
  constructor(private filter?: { status?: Item["status"] }) {}
  capturedFilter?: { status?: Item["status"] };
  async create() {
    return items[0]!;
  }
  async update() {
    return items[0]!;
  }
  async findById() {
    return items[0]!;
  }
  async findBySellerId(_: string, filter?: { status?: Item["status"] }) {
    this.capturedFilter = filter;
    return filter?.status ? items.filter((i) => i.status === filter.status) : items;
  }
  async delete() {}
  async setStatus() {
    return items[0]!;
  }
  async countBids() {
    return 0;
  }
}

describe("listSellerItems", () => {
  it("lista todos os itens do seller sem filtro", async () => {
    const repo = new FakeItemRepository();
    const result = await listSellerItems(repo, "u1");
    expect(result).toHaveLength(2);
  });

  it("filtra por status quando informado", async () => {
    const repo = new FakeItemRepository();
    const result = await listSellerItems(repo, "u1", { status: "active" });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("i2");
    expect(repo.capturedFilter).toEqual({ status: "active" });
  });
});
