import { describe, expect, it } from "vitest";
import { getItemBySlugAndId } from "./get-item-by-slug-and-id";
import type { Bid, BidRepository } from "@/domain/repositories/bid-repository";
import type { Item, ItemImage, ItemRepository } from "@/domain/repositories/item-repository";
import type { UserProfile, UserRepository } from "@/domain/repositories/user-repository";

const seller: UserProfile = {
  id: "u1",
  name: "Ana",
  email: "ana@ex.com",
  phone: null,
  slug: "ana-impala",
  address: null,
  role: "seller",
};

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

class FakeItemRepository implements ItemRepository {
  constructor(
    private item: Item | null,
    private images: ItemImage[] = [],
  ) {}
  async findById() {
    return this.item;
  }
  async findImagesByItemId() {
    return this.images;
  }
  create() {
    return Promise.reject(new Error("não usado"));
  }
  update() {
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
  createImages() {
    return Promise.reject(new Error("não usado"));
  }
  deleteImage() {
    return Promise.reject(new Error("não usado"));
  }
}

class FakeUserRepository implements UserRepository {
  constructor(private user: UserProfile | null) {}
  async findById() {
    return this.user;
  }
  async findBySlug() {
    return null;
  }
  updateProfile() {
    return Promise.reject(new Error("não usado"));
  }
  updateRole() {
    return Promise.reject(new Error("não usado"));
  }
}

class FakeBidRepository implements BidRepository {
  constructor(private bids: Bid[] = []) {}
  async findByItemId() {
    return this.bids;
  }
}

const bid: Bid = {
  id: "b1",
  itemId: "i1",
  bidderId: "bob",
  bidderName: "bob",
  amount: 5500,
  rank: 1,
  createdAt: new Date(),
};

describe("getItemBySlugAndId", () => {
  it("retorna item, imagens e lances para item ativo com slug correto", async () => {
    const item = makeItem();
    const images = [{ id: "img1", itemId: "i1", url: "/a.jpg", position: 0, createdAt: new Date() }];
    const uc = getItemBySlugAndId;
    await expect(
      uc(new FakeItemRepository(item, images), new FakeUserRepository(seller), new FakeBidRepository([bid]), "ana-impala", "i1"),
    ).resolves.toEqual({ item, images, bids: [bid] });
  });

  it("retorna null quando o slug não corresponde ao seller do item", async () => {
    await expect(
      getItemBySlugAndId(new FakeItemRepository(makeItem()), new FakeUserRepository(seller), new FakeBidRepository(), "outro-slug", "i1"),
    ).resolves.toBeNull();
  });

  it("retorna null quando o item não está ativo", async () => {
    await expect(
      getItemBySlugAndId(new FakeItemRepository(makeItem({ status: "draft" })), new FakeUserRepository(seller), new FakeBidRepository(), "ana-impala", "i1"),
    ).resolves.toBeNull();
  });

  it("retorna null quando o item não existe", async () => {
    await expect(
      getItemBySlugAndId(new FakeItemRepository(null), new FakeUserRepository(seller), new FakeBidRepository(), "ana-impala", "i1"),
    ).resolves.toBeNull();
  });
});