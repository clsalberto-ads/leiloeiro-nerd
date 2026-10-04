import type { Period } from "@/app/(dashboard)/dashboard/period/period";

export interface ContestedItem {
  id: string;
  title: string;
  bids: number;
  highestBid: number | null;
  minInitialBid: number;
  bidDeadline: Date;
}

export interface RecentBid {
  id: string;
  itemId: string;
  itemTitle: string;
  sellerSlug: string | null;
  amount: number;
  createdAt: Date;
  isLeading: boolean;
}

export interface DailyPoint {
  day: string;
  total: number;
}

export interface BuyerSummary {
  totalBids: number;
  watchedItems: number;
  leading: number;
  outbid: number;
  bidsPerDay: DailyPoint[];
  recent: RecentBid[];
}

export interface SellerSummary {
  totalItems: number;
  activeItems: number;
  listedValue: number;
  itemsByStatus: Array<{ status: any; total: number }>;
  itemsByType: { type: string; total: number }[];
  mostContested: { id: string; title: string; bids: number; highestBid: number | null }[];
}

export interface SellerSeries {
  bidsPerDay: DailyPoint[];
  itemsCreatedPerDay: DailyPoint[];
}

export interface AnalyticsRepository {
  sellerSummary(sellerId: string, days: number): Promise<SellerSummary>;
  sellerSeries(sellerId: string, days: number): Promise<SellerSeries>;
  buyerSummary(bidderId: string, days: number): Promise<BuyerSummary>;
  getRevenueApproved(sellerId: string, period: Period): Promise<{ amountCents: number }>;
  getPendingPaymentsAmount(sellerId: string, period?: Period): Promise<{ amountCents: number }>;
  getApprovedCount(sellerId: string, period: Period): Promise<{ count: number }>;
  getAverageTicketApproved(sellerId: string, period: Period): Promise<{ amountCents: number }>;
}
