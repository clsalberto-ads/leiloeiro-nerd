import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BuyerSummary, SellerSummary, SellerSeries } from "@/domain/repositories/analytics-repository";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  analise: {
    sellerSummary: vi.fn(),
    sellerSeries: vi.fn(),
    buyerSummary: vi.fn(),
  },
}));

vi.mock("@/presentation/actions/auth-actions", () => ({ getSession: mocks.session, signOutAction: vi.fn() }));
vi.mock("@/infrastructure/database/repositories/drizzle-analytics-repository", () => ({
  drizzleAnalyticsRepository: mocks.analise,
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

import DashboardPage from "./page";

const SELLER_SUMMARY: SellerSummary = {
  totalItems: 4,
  activeItems: 2,
  listedValue: 15000,
  itemsByStatus: [
    { status: "active", total: 2 },
    { status: "draft", total: 2 },
  ],
  itemsByType: [{ type: "product", total: 4 }],
  mostContested: [{ id: "i1", title: "Console retrô", bids: 4, highestBid: 7000 }],
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
      itemTitle: "Console retrô",
      sellerSlug: "loja-da-ana",
      amount: 7000,
      createdAt: new Date("2026-09-29T12:00:00Z"),
      isLeading: true,
    },
  ],
};

function props(periodo?: string) {
  return { params: Promise.resolve({}), searchParams: Promise.resolve(periodo ? { periodo } : {}) };
}

describe("dashboard/page — a visao segue o papel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.analise.sellerSummary.mockResolvedValue(SELLER_SUMMARY);
    mocks.analise.sellerSeries.mockResolvedValue(SERIES);
    mocks.analise.buyerSummary.mockResolvedValue(BUYER_SUMMARY);
  });

  // ponytail: a tela e SERVER, mas os graficos sao CLIENT (`recharts`). O
  // `renderToStaticMarkup` renderiza a arvore toda do servidor — o que prova que
  // a fronteira `use client` foi montada no lugar certo (dados para dentro, nada
  // de `window`), e nao so que a pagina retorna um objeto.
  it("seller recebe os indicadores, os graficos e o ranking", async () => {
    mocks.session.mockResolvedValue({ user: { id: "u1", name: "Ana", email: "ana@ex.com", role: "seller" } });
    const html = renderToStaticMarkup(await DashboardPage(props()));

    expect(html).toContain("Seu painel");
    expect(html).toContain("Itens no total");
    expect(html).toContain("Console retrô");
    expect(html).toContain("4");
    // a vitrine de comprador nao pode vazar para o vendedor
    expect(html).not.toContain("Meus lances recentes");
  });

  it("both cai na visao de vendedor", async () => {
    mocks.session.mockResolvedValue({ user: { id: "u1", name: "Ana", email: "ana@ex.com", role: "both" } });
    const html = renderToStaticMarkup(await DashboardPage(props()));
    expect(html).toContain("Seu painel");
    expect(mocks.analise.sellerSummary).toHaveBeenCalledWith("u1", 30);
    expect(mocks.analise.buyerSummary).not.toHaveBeenCalled();
  });

  it("bidder recebe a visao de lances e o link do item leva o slug do vendedor", async () => {
    mocks.session.mockResolvedValue({ user: { id: "u9", name: "Bia", email: "bia@ex.com", role: "bidder" } });
    const html = renderToStaticMarkup(await DashboardPage(props()));

    expect(html).toContain("Meus lances");
    expect(html).toContain("Seus lances recentes");
    // a rota publica e /[slug]/[itemId] e o `getItemBySlugAndId` recusa o slug
    // errado — um href `/${itemId}` daria 404
    expect(html).toContain("/loja-da-ana/i1");
    expect(mocks.analise.sellerSummary).not.toHaveBeenCalled();
  });

  // ponytail: o papel vem do better-auth como `string`, nao como a union do
  // dominio. Um papel desconhecido tem que cair no ramo MENOS privilegiado — a
  // visao de comprador. O inverso mostraria um painel vazio com cara de bug.
  it("papel desconhecido cai na visao de comprador, nao na de vendedor", async () => {
    mocks.session.mockResolvedValue({ user: { id: "u1", name: "X", email: "x@ex.com", role: "admin" } });
    const html = renderToStaticMarkup(await DashboardPage(props()));
    expect(html).toContain("Meus lances");
    expect(mocks.analise.sellerSummary).not.toHaveBeenCalled();
  });

  it("sem sessao nao renderiza nada nem consulta a analise", async () => {
    mocks.session.mockResolvedValue(null);
    expect(await DashboardPage(props())).toBeNull();
    expect(mocks.analise.sellerSummary).not.toHaveBeenCalled();
    expect(mocks.analise.buyerSummary).not.toHaveBeenCalled();
  });
});

describe("dashboard/page — o periodo vem da URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.analise.sellerSummary.mockResolvedValue(SELLER_SUMMARY);
    mocks.analise.sellerSeries.mockResolvedValue(SERIES);
  });

  it.each([
    ["7d", 7],
    ["30d", 30],
    ["90d", 90],
  ])("?periodo=%s chega na consulta como %i dias", async (key, days) => {
    mocks.session.mockResolvedValue({ user: { id: "u1", name: "Ana", email: "a@e.com", role: "seller" } });
    await DashboardPage(props(key));
    expect(mocks.analise.sellerSeries).toHaveBeenCalledWith("u1", days);
  });

  it("sem ?periodo usa 30 dias", async () => {
    mocks.session.mockResolvedValue({ user: { id: "u1", name: "Ana", email: "a@e.com", role: "seller" } });
    await DashboardPage(props());
    expect(mocks.analise.sellerSeries).toHaveBeenCalledWith("u1", 30);
  });

  // ponytail: `?periodo=lixo` NAO pode virar 404 nem um intervalo arbitrario.
  // A leitura e do `parsePeriod` (testado la); aqui so interessa o
  // efeito colateral — um valor malformado que escapasse chegaria ao
  // `date_trunc` do Postgres e viraria "todos os dias, sempre".
  it("?periodo invalido cai no padrao de 30 dias", async () => {
    mocks.session.mockResolvedValue({ user: { id: "u1", name: "Ana", email: "a@e.com", role: "seller" } });
    await DashboardPage(props(";drop table items"));
    expect(mocks.analise.sellerSeries).toHaveBeenCalledWith("u1", 30);
  });

  it("?periodo repetido usa o primeiro valor, como o URLSearchParams.get", async () => {
    mocks.session.mockResolvedValue({ user: { id: "u1", name: "Ana", email: "a@e.com", role: "seller" } });
    await DashboardPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ periodo: ["7d", "90d"] }) });
    expect(mocks.analise.sellerSeries).toHaveBeenCalledWith("u1", 7);
  });
});
