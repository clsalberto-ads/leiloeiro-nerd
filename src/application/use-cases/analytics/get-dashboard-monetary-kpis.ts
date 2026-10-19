import type { AnalyticsRepository } from "@/domain/repositories/analytics-repository";
import type { Period } from "@/app/(dashboard)/dashboard/period/period";

export interface DashboardMonetaryKPIs {
  revenueCents: number;
  pendingCents: number;
  approvedCount: number;
  avgTicketCents: number;
}

// ponytail: este use case monta os KPIs MONETÁRIOS do painel do vendedor e
// AINDA NÃO está ligado a nenhuma página — é a base da "Fase 3" (Mercado Pago /
// pagamentos), e o `payments` ainda não é produzido por nenhum fluxo de checkout.
// Ele existe para o dia em que a integração chegar; até lá, não há consumidor, e
// não deve ser removido porque o contrato do repositório já é exercitado nos
// testes. Os quatro KPIs usam o MESMO `period` de propósito.
export async function getDashboardMonetaryKPIs(
  analytics: AnalyticsRepository,
  sellerId: string,
  period: Period,
): Promise<DashboardMonetaryKPIs> {
  const [rev, pend, cnt, avg] = await Promise.all([
    analytics.getRevenueApproved(sellerId, period),
    analytics.getPendingPaymentsAmount(sellerId, period),
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
