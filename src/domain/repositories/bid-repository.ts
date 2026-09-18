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

export interface BidRepository {
  findByItemId(itemId: string): Promise<Bid[]>;
  createBid(input: CreateBidInput): Promise<Bid>;
}