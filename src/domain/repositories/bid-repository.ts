export interface Bid {
  id: string;
  itemId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  rank: number | null;
  createdAt: Date;
}

export interface CreateBidInput {
  itemId: string;
  bidderId: string;
  amount: number;
}

export interface LockedBidItem {
  id: string;
  title: string;
  sellerId: string;
  status: string;
  bidDeadline: Date;
  minInitialBid: number;
  minBidIncrement: number;
}

export interface BidPlacement {
  bid: Bid;
  previousHighestBid: Bid | null;
}

export interface BidRepository {
  findByItemId(itemId: string): Promise<Bid[]>;
  placeBid(
    input: CreateBidInput,
    validate: (ctx: { item: LockedBidItem | null; highestBid: Bid | undefined }) => void,
  ): Promise<BidPlacement>;
}