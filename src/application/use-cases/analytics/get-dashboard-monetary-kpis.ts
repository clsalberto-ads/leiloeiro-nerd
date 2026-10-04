import type { AnalyticsRepository } from "@/domain/repositories/analytics-repository";
import type { Period } from "@/app/(dashboard)/dashboard/period/period";

export interface DashboardMonetaryKPIs {
  revenueCents: number;
  pendingCents: number;
  approvedCount: number;
  avgTicketCents: number;
}

export async function getDashboardMonetaryKPIs(
  analytics: AnalyticsRepository,
  sellerId: string,
  period: Period,
): Promise<DashboardMonetaryKPIs> {
  const [rev, pend, cnt, avg] = await Promise.all([
    analytics.getRevenueApproved(sellerId, period),
    analytics.getPendingPaymentsAmount(sellerId),
    analytics.getApprovedCount(sellerId, period),
    analytics.getAverageTicketApproved(sellerId, period),
  ]);
  return {
    revenueCents: rev.amountCents,
    pendingCents: pend.amountCents,
    approvedCount: cnt.count,
    avgTicketCents: avg.amountCents,
  };
}
