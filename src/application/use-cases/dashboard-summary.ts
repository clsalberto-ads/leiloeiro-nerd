import type { AnalyticsRepository, BuyerSummary, SellerSummary, SellerSeries } from "@/domain/repositories/analytics-repository";
import type { UserRole } from "@/domain/repositories/user-repository";

export interface SellerView {
  role: "seller";
  summary: SellerSummary;
  series: SellerSeries;
}

export interface BuyerView {
  role: "buyer";
  summary: BuyerSummary;
}

export type DashboardView = SellerView | BuyerView;

// ponytail: o `?periodo` NAO entra aqui. Ele e lido pela pagina (que tem os
// `searchParams`) e chega como `dias` ja validado pelo `parsePeriod` —
// um inteiro de uma lista de tres. Passar a chave do URL para dentro do dominio
// seria devolver a esse modulo a responsabilidade de decidir o que "7d" quer
// dizer, que e da fronteira da URL. Aqui so entra `dias: number`, e `dias <= 0`
// e defensivo para nao virar um `GROUP BY` sobre a tabela inteira se algum
// chamador novo passar um valor estragado.
function clampWindowDays(days: number): number {
  // ponytail: o `Number.isFinite` vem ANTES do `Math.trunc`, e nao depois. Testando a fracao
  // primeiro, `0.5` passava ("0.5 > 0") e truncava para `0` — a janela que este
  // fallback existe para impedir. Truncar primeiro faz `NaN` chegar no Postgres ja
  // como `NaN` e cair no padrao, que e o que o chamador degenerado merece.
  if (!Number.isFinite(days)) return 30;
  const whole = Math.trunc(days);
  return whole > 0 ? Math.min(whole, 366) : 30;
}

/**
 * Monta a visao do dashboard para o papel do usuario.
 *
 * ponytail: `both` cai no ramo do VENDEDOR, e nao num terceiro caso "os dois".
 * Quem tem os dois papeis tem items E da lances, e os dois conjuntos vivem lado
 * a lado no mesmo produto: a analise de venda e a principal (e a que pede
 * grafico), enquanto os lances proprios sao um complemento — a tela de comprador
 * existe para quem nao vende. Um ramo "ambos" seria uma terceira combinacao de
 * layout para um caso que a analise de seller ja responde.
 */
export async function getDashboardSummary(
  analytics: AnalyticsRepository,
  userId: string,
  role: UserRole,
  days: number,
): Promise<DashboardView> {
  if (role === "seller" || role === "both") {
    const [summary, series] = await Promise.all([
      analytics.sellerSummary(userId, clampWindowDays(days)),
      analytics.sellerSeries(userId, clampWindowDays(days)),
    ]);
    return { role: "seller", summary, series };
  }
  return { role: "buyer", summary: await analytics.buyerSummary(userId, clampWindowDays(days)) };
}
