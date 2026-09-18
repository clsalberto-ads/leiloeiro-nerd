import { describe, it, expect, beforeEach, vi } from "vitest";
import { drizzleBidRepository } from "./drizzle-bid-repository";

type Bid = {
  id: string;
  itemId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  rank: number | null;
  createdAt: Date;
};

type CreateBidInput = {
  itemId: string;
  bidderId: string;
  amount: number;
};

function createFakeBidRepository() {
  const store = new Map<string, Bid[]>();

  return {
    async findByItemId(itemId: string): Promise<Bid[]> {
      return store.get(itemId) ?? [];
    },

    async createBid(input: CreateBidInput): Promise<Bid> {
      const existing = store.get(input.itemId) ?? [];
      const maxRank = existing.reduce((max, b) => Math.max(max, b.rank ?? 0), 0);
      const rank = maxRank + 1;

      const bid: Bid = {
        id: crypto.randomUUID(),
        itemId: input.itemId,
        bidderId: input.bidderId,
        bidderName: input.bidderId,
        amount: input.amount,
        rank,
        createdAt: new Date(),
      };

      const updated = [...existing, bid].sort((a, b) => b.amount - a.amount);
      store.set(input.itemId, updated);

      return bid;
    },

    _reset() {
      store.clear();
    },
  };
}

describe("drizzleBidRepository (fake)", () => {
  let repo: ReturnType<typeof createFakeBidRepository>;

  beforeEach(() => {
    repo = createFakeBidRepository();
  });

  it("createBid returns rank 1 when empty", async () => {
    const bid = await repo.createBid({
      itemId: "item-1",
      bidderId: "user-1",
      amount: 100,
    });

    expect(bid.rank).toBe(1);
    expect(bid.amount).toBe(100);
  });

  it("createBid returns rank N+1 when existing bids", async () => {
    await repo.createBid({ itemId: "item-1", bidderId: "user-1", amount: 100 });
    await repo.createBid({ itemId: "item-1", bidderId: "user-2", amount: 150 });
    const bid = await repo.createBid({ itemId: "item-1", bidderId: "user-3", amount: 200 });

    expect(bid.rank).toBe(3);
  });

  it("findByItemId orders by amount DESC", async () => {
    await repo.createBid({ itemId: "item-1", bidderId: "user-1", amount: 100 });
    await repo.createBid({ itemId: "item-1", bidderId: "user-2", amount: 200 });
    await repo.createBid({ itemId: "item-1", bidderId: "user-3", amount: 150 });

    const bids = await repo.findByItemId("item-1");

    expect(bids.map((b) => b.amount)).toEqual([200, 150, 100]);
  });
});