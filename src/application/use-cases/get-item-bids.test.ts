import { describe, expect, it } from "vitest";
import { getItemBids } from "./get-item-bids";
import type { Bid, BidRepository, CreateBidInput } from "@/domain/repositories/bid-repository";
import type { UserProfile, UserRepository } from "@/domain/repositories/user-repository";
import type { LockedBidItem } from "@/domain/repositories/bid-repository";

function makeBid(overrides: Partial<Bid> = {}): Bid {
  return {
    id: "b1",
    itemId: "i1",
    bidderId: "bob",
    bidderName: "bob",
    amount: 5000,
    rank: 1,
    createdAt: new Date(),
    ...overrides,
  };
}

const bob: UserProfile = {
  id: "bob",
  name: "Bob Silva",
  email: "bob@ex.com",
  phone: null,
  slug: null,
  address: null,
  role: "bidder",
};

class FakeBidRepository implements BidRepository {
  constructor(private bids: Bid[]) {}
  async findByItemId() {
    return this.bids;
  }
  async placeBid(_input: CreateBidInput, _validate: (ctx: { item: LockedBidItem | null; highestBid: Bid | undefined }) => void): Promise<never> {
    throw new Error("não usado");
  }
}

class FakeUserRepository implements UserRepository {
  userBy: Record<string, UserProfile | null>;
  constructor(users: Record<string, UserProfile | null>) {
    this.userBy = users;
  }
  async findById(userId: string) {
    return this.userBy[userId] ?? null;
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

describe("getItemBids", () => {
  it("substitui bidderName pelo nome real do usuário", async () => {
    const bids = [makeBid()];
    const result = await getItemBids(new FakeBidRepository(bids), new FakeUserRepository({ bob }), "i1");
    expect(result[0]?.bidderName).toBe("Bob Silva");
  });

  it("mantém bidderId quando o usuário não é encontrado", async () => {
    const bids = [makeBid({ bidderId: "desconhecido", bidderName: "desconhecido" })];
    const result = await getItemBids(new FakeBidRepository(bids), new FakeUserRepository({}), "i1");
    expect(result[0]?.bidderName).toBe("desconhecido");
  });

  it("preserva a ordem do repositório", async () => {
    const bids = [
      makeBid({ id: "b1", bidderId: "bob", amount: 5000 }),
      makeBid({ id: "b2", bidderId: "ana", amount: 4800 }),
      makeBid({ id: "b3", bidderId: "carol", amount: 4500 }),
    ];
    const result = await getItemBids(new FakeBidRepository(bids), new FakeUserRepository({}), "i1");
    expect(result.map((b) => b.id)).toEqual(["b1", "b2", "b3"]);
  });
});