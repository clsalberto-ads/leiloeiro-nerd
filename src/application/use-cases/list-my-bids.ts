import type { BidRepository, Bid } from "@/domain/repositories/bid-repository";
import type { Item, ItemRepository } from "@/domain/repositories/item-repository";

export interface MyBidRow {
  bid: Bid;
  item: Item | null;
}

export async function listMyBids(
  bidRepo: BidRepository,
  itemRepo: Pick<ItemRepository, "findById">,
  bidderId: string,
  limit = 50,
) {
  const bids = await bidRepo.listByBidder(bidderId, limit);
  const rows: MyBidRow[] = await Promise.all(
    bids.map(async (bid) => {
      const item = await itemRepo.findById(bid.itemId);
      return { bid, item };
    }),
  );
  return rows;
}
