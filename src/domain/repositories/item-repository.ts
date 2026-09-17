export type ItemType = "product" | "service" | "piece";
export type ItemStatus = "draft" | "active" | "closed" | "awaiting_payment" | "paid" | "cancelled";

export interface Item {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  type: ItemType;
  imageUrl: string | null;
  minInitialBid: number;
  minBidIncrement: number;
  bidDeadline: Date;
  paymentDeadlineDays: number;
  status: ItemStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateItemInput {
  sellerId: string;
  title: string;
  description: string;
  type: ItemType;
  minInitialBid: number;
  minBidIncrement: number;
  bidDeadline: Date;
  paymentDeadlineDays?: number;
}

export interface UpdateItemInput {
  title?: string;
  description?: string;
  type?: ItemType;
  minInitialBid?: number;
  minBidIncrement?: number;
  bidDeadline?: Date;
  paymentDeadlineDays?: number;
}

export interface ItemListFilter {
  status?: ItemStatus;
}

export interface ItemRepository {
  create(input: CreateItemInput): Promise<Item>;
  update(id: string, input: UpdateItemInput): Promise<Item | null>;
  findById(id: string): Promise<Item | null>;
  findBySellerId(sellerId: string, filter?: ItemListFilter): Promise<Item[]>;
  delete(id: string): Promise<void>;
  setStatus(id: string, status: ItemStatus): Promise<Item | null>;
  countBids(itemId: string): Promise<number>;
}