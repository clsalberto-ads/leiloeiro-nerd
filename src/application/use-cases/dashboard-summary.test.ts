import { describe, expect, it, vi } from "vitest";
import { getDashboardSummary } from "./dashboard-summary";
import type { AnalyticsRepository, BuyerSummary, SellerSummary, SellerSeries } from "@/domain/repositories/analytics-repository";

const SELLER_SUMMARY: SellerSummary = {
  totalItems: 3,
  activeItems: 2,
  listedValue: 15000,
  itemsByStatus: [{ status: "active", total: 2 }],
  itemsByType: [{ type: "product", total: 3 }],
  mostContested: [{ id: "i1", title: "Console", bids: 4, highestBid: 7000 }],
};

const SERIES: SellerSeries = {
  bidsPerDay: [{ day: "2026-09-29", total: 4 }],
  itemsCreatedPerDay: [{ day: "2026-09-29", total: 1 }],
};

const BUYER_SUMMARY: BuyerSummary = {
  totalBids: 5,
  watchedItems: 2,
  leading: 3,
  outbid: 2,
  bidsPerDay: [{ day: "2026-09-29", total: 5 }],
  recent: [
    {
      id: "b1",
      itemId: "i1",
      itemTitle: "Console",
      sellerSlug: "loja-da-ana",
      amount: 7000,
      createdAt: new Date("2026-09-29T12:00:00Z"),
      isLeading: true,
    },
  ],
};

function fake(): AnalyticsRepository & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async sellerSummary(id) {
      calls.push(`sellerSummary:${id}`);
      return SELLER_SUMMARY;
    },
    async sellerSeries(id, days) {
      calls.push(`sellerSeries:${id}:${days}`);
      return SERIES;
    },
    async buyerSummary(id, days) {
      calls.push(`buyerSummary:${id}:${days}`);
      return BUYER_SUMMARY;
    },    async getRevenueApproved() { return { amountCents: 0 }; },
    async getPendingPaymentsAmount() { return { amountCents: 0 }; },
    async getApprovedCount() { return { count: 0 }; },
    async getAverageTicketApproved() { return { amountCents: 0 }; },
  };
}

describe("getDashboardSummary", () => {
  // ponytail: `both` vai para o ramo do VENDEDOR, e nao para um "os dois" — quem
  // tem os dois papeis tem itens E da lances, e os dois conjuntos vivem lado a
  // lado. Este e o teste que trava essa escolha: trocar por um terceiro ramo
  // entregaria uma tela nova e sem dono.
  it.each(["seller", "both"] as const)("papel %s recebe a visao de vendedor", async (role) => {
    const analytics = fake();
    const view = await getDashboardSummary(analytics, "u1", role, 30);
    expect(view.role).toBe("seller");
    expect(analytics.calls).toEqual(["sellerSummary:u1", "sellerSeries:u1:30"]);
  });

  it("papel bidder recebe a visao de comprador e nao toca em seller", async () => {
    const analytics = fake();
    const view = await getDashboardSummary(analytics, "u1", "bidder", 30);
    expect(view.role).toBe("buyer");
    expect(analytics.calls).toEqual(["buyerSummary:u1:30"]);
  });

  it("repassa o periodo como dias, e nao a chave do URL", async () => {
    const analytics = fake();
    await getDashboardSummary(analytics, "u1", "seller", 7);
    expect(analytics.calls).toContain("sellerSeries:u1:7");
  });

  // ponytail: `clampWindowDays` e defensivo porque e o UNICO lugar entre o
  // `?periodo` da URL e o `date_trunc` do Postgres. O `parsePeriod` ja so
  // devolve 7, 30 ou 90 — mas se um chamador novo passar `0` ou `-5`, sem esta
  // guarda viraria um `GROUP BY` sobre a tabela inteira de `bids`, que e a
  // consulta que derruba o pool. O teste existe para travar essa borda, nao
  // para documentar comportamento que o chamador correto nunca produz.
  it.each([
    [0, 30],
    [-5, 30],
    [NaN, 30],
    [Infinity, 30],
    [10_000, 366],
    [7.9, 7],
    // ponytail: fracao que TRUNCA para zero. O guard testava `days > 0` na fracao
    // e so depois aplicava `Math.trunc`, entao `0.5` passava ("0.5 > 0") e virava
    // `clampWindowDays(0)` — o pior desfecho possivel aqui, porque o fallback de 30 existe
    // justamente para nunca chegar a `0`. Janela zero e um `date_trunc` degenerado
    // la no Postgres, nao um painel vazio.
    [0.5, 30],
  ])("um `days` degenerado (%o) nao vira clampWindowDays maior que 366", async (input, expected) => {
    const analytics = fake();
    await getDashboardSummary(analytics, "u1", "bidder", input);
    expect(analytics.calls[0]).toBe(`buyerSummary:u1:${expected}`);
  });

  it("nao faz a consulta de vendedor para quem so compra", async () => {
    const analytics = fake();
    const spy = vi.spyOn(analytics, "sellerSummary");
    await getDashboardSummary(analytics, "u1", "bidder", 30);
    expect(spy).not.toHaveBeenCalled();
  });
});
