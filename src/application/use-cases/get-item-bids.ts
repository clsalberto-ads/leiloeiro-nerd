import type { Bid, BidRepository } from "@/domain/repositories/bid-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";

export async function resolveBidderNames(bids: Bid[], userRepo: UserRepository): Promise<Bid[]> {
  return Promise.all(
    bids.map(async (bid) => {
      const user = await userRepo.findById(bid.bidderId);
      if (!user) return bid;
      return { ...bid, bidderName: user.name };
    }),
  );
}

export async function getItemBids(
  bidRepo: BidRepository,
  userRepo: UserRepository,
  itemId: string,
): Promise<Bid[]> {
  const bids = await bidRepo.findByItemId(itemId);
  return resolveBidderNames(bids, userRepo);
}