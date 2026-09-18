import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSellerBySlug: vi.fn(),
  listActiveItemsBySellerId: vi.fn(),
  getItemBySlugAndId: vi.fn(),
}));

vi.mock("@/application/use-cases/get-seller-by-slug", () => ({
  getSellerBySlug: mocks.getSellerBySlug,
}));
vi.mock("@/application/use-cases/list-active-items-by-seller", () => ({
  listActiveItemsBySellerId: mocks.listActiveItemsBySellerId,
}));
vi.mock("@/application/use-cases/get-item-by-slug-and-id", () => ({
  getItemBySlugAndId: mocks.getItemBySlugAndId,
}));

import { getItemDetailAction, getSellerVitrineAction } from "./public-actions";
import type { Item } from "@/domain/repositories/item-repository";

const seller = { id: "u1", name: "Ana", slug: "ana-impala" };

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "i1",
    sellerId: "u1",
    title: "Action Figure rara",
    description: "Lacrada.",
    type: "product",
    imageUrl: null,
    minInitialBid: 5000,
    minBidIncrement: 500,
    bidDeadline: new Date(),
    paymentDeadlineDays: 3,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("getSellerVitrineAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna { seller, items } quando o seller existe", async () => {
    const item = makeItem();
    mocks.getSellerBySlug.mockResolvedValue(seller);
    mocks.listActiveItemsBySellerId.mockResolvedValue([item]);

    await expect(getSellerVitrineAction("ana-impala")).resolves.toEqual({ seller, items: [item] });
    expect(mocks.listActiveItemsBySellerId).toHaveBeenCalledWith(expect.anything(), "u1");
  });

  it("retorna { seller: null, items: [] } e não busca itens quando o slug não existe", async () => {
    mocks.getSellerBySlug.mockResolvedValue(null);

    await expect(getSellerVitrineAction("slug-inexistente")).resolves.toEqual({ seller: null, items: [] });
    expect(mocks.listActiveItemsBySellerId).not.toHaveBeenCalled();
  });
});

describe("getItemDetailAction", () => {
  it("retorna { item, images, bids }", async () => {
    const item = makeItem();
    const images = [{ id: "img1", itemId: "i1", url: "/a.jpg", position: 0, createdAt: new Date() }];
    const bids: never[] = [];
    mocks.getItemBySlugAndId.mockResolvedValue({ item, images, bids });

    await expect(getItemDetailAction("ana-impala", "i1")).resolves.toEqual({ item, images, bids });
  });

  it("retorna campos vazios quando inexistente", async () => {
    mocks.getItemBySlugAndId.mockResolvedValue(null);

    await expect(getItemDetailAction("ana-impala", "i-inexistente")).resolves.toEqual({
      item: null,
      images: [],
      bids: [],
    });
  });
});