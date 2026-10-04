import { describe, expect, it } from "vitest";
import { listMyBids } from "./list-my-bids";
import type { Bid, BidRepository } from "@/domain/repositories/bid-repository";
import type { Item, ItemRepository } from "@/domain/repositories/item-repository";

class FakeBidRepo implements BidRepository {
  constructor(private bids: Bid[] = []) {}
  async findByItemId() { return []; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async placeBid(_input: any, _validate: (ctx: { item: any; highestBid: any }) => void): Promise<any> { throw new Error("no"); }
  async listByBidder(_bidderId: string) { return this.bids; }
}

class FakeItemRepo implements Pick<ItemRepository, "findById"> {
  map = new Map<string, Item>();
  async findById(id: string) { return this.map.get(id) ?? null; }
}

describe("listMyBids", () => {
  it("retorna histórico com itens", async () => {
    const bid: Bid = { id: 'b1', itemId: 'i1', bidderId: 'u1', bidderName: 'u1', amount: 1000, rank: 1, createdAt: new Date() } as Bid;
    const item = { id: 'i1', title: 'T', description:'d', type:'product', imageUrl:null, minInitialBid:1000, minBidIncrement:500, bidDeadline:new Date(), paymentDeadlineDays:3, status:'active', createdAt:new Date(), updatedAt: new Date() } as Item;
    const br = new FakeBidRepo([bid]);
    const ir = new FakeItemRepo(); ir.map.set('i1', item);
    const res = await listMyBids(br, ir, 'u1');
    expect(res[0].item?.title).toBe('T');
  });
});
