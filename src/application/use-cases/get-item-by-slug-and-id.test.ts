import { describe, expect, it } from "vitest";
import { getItemBySlugAndId } from "./get-item-by-slug-and-id";
import type { Bid, BidRepository, CreateBidInput, LockedBidItem } from "@/domain/repositories/bid-repository";
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
    id: "f083f5e5-f629-4a2b-a443-1e911ccd2f26",
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
  async closeExpired() {
    return [];
  }
  async updateDraft(): Promise<Item | null> {
    throw new Error("não usado");
  }
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
  async findImageById() {
    return null;
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
  userBy: Record<string, UserProfile | null>;
  constructor(user: UserProfile | null = null) {
    this.userBy = user ? { [user.id]: user } : {};
  }
  async findById(userId: string) {
    return this.userBy[userId] ?? null;
  }
  async findByIds(ids: string[]) {
    return ids.map((id) => this.userBy[id]).filter((u): u is NonNullable<typeof u> => Boolean(u));
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
  async placeBid(_input: CreateBidInput, _validate: (ctx: { item: LockedBidItem | null; highestBid: Bid | undefined }) => void): Promise<never> {
    throw new Error("não usado");
  }
  async listByBidder(_bidderId: string): Promise<Bid[]> {
    return [];
  }
}

const bid: Bid = {
  id: "b1",
  itemId: "f083f5e5-f629-4a2b-a443-1e911ccd2f26",
  bidderId: "bob",
  bidderName: "bob",
  amount: 5500,
  rank: 1,
  createdAt: new Date(),
};

describe("getItemBySlugAndId", () => {
  it("retorna item, imagens e lances para item ativo com slug correto", async () => {
    const item = makeItem();
    const images = [{ id: "img1", itemId: "f083f5e5-f629-4a2b-a443-1e911ccd2f26", url: "/a.jpg", position: 0, createdAt: new Date() }];
    const uc = getItemBySlugAndId;
    await expect(
      uc(new FakeItemRepository(item, images), new FakeUserRepository(seller), new FakeBidRepository([bid]), "ana-impala", "f083f5e5-f629-4a2b-a443-1e911ccd2f26"),
    ).resolves.toEqual({ item, images, bids: [bid] });
  });

  it("resolve nomes dos arrematantes no primeiro render (mesmo path do polling)", async () => {
    const bob: UserProfile = {
      id: "bob",
      name: "Bob Silva",
      email: "bob@ex.com",
      phone: null,
      slug: null,
      address: null,
      role: "bidder",
    };
    const users = new FakeUserRepository(seller);
    users.userBy["bob"] = bob;
    const result = await getItemBySlugAndId(
      new FakeItemRepository(makeItem()),
      users,
      new FakeBidRepository([bid]),
      "ana-impala",
      "f083f5e5-f629-4a2b-a443-1e911ccd2f26",
    );
    expect(result?.bids[0]?.bidderName).toBe("Bob Silva");
  });

  it("retorna null quando o slug não corresponde ao seller do item", async () => {
    await expect(
      getItemBySlugAndId(new FakeItemRepository(makeItem()), new FakeUserRepository(seller), new FakeBidRepository(), "outro-slug", "f083f5e5-f629-4a2b-a443-1e911ccd2f26"),
    ).resolves.toBeNull();
  });

  it("retorna null quando o item não está ativo", async () => {
    await expect(
      getItemBySlugAndId(new FakeItemRepository(makeItem({ status: "draft" })), new FakeUserRepository(seller), new FakeBidRepository(), "ana-impala", "f083f5e5-f629-4a2b-a443-1e911ccd2f26"),
    ).resolves.toBeNull();
  });

  it("retorna null quando o item não existe", async () => {
    await expect(
      getItemBySlugAndId(new FakeItemRepository(null), new FakeUserRepository(seller), new FakeBidRepository(), "ana-impala", "f083f5e5-f629-4a2b-a443-1e911ccd2f26"),
    ).resolves.toBeNull();
  });

  it("retorna null para itemId que não é UUID", async () => {
    await expect(
      getItemBySlugAndId(new FakeItemRepository(makeItem()), new FakeUserRepository(seller), new FakeBidRepository(), "ana-impala", "i-inexistente"),
    ).resolves.toBeNull();
  });
});