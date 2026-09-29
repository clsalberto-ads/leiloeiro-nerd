import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumoDoComprador, ResumoDoVendedor, SeriesDoVendedor } from "@/domain/repositories/analise-repository";

const mocks = vi.hoisted(() => ({
  sessao: vi.fn(),
  analise: {
    resumoDoVendedor: vi.fn(),
    seriesDoVendedor: vi.fn(),
    resumoDoComprador: vi.fn(),
  },
}));

vi.mock("@/presentation/actions/auth-actions", () => ({ getSession: mocks.sessao, signOutAction: vi.fn() }));
vi.mock("@/infrastructure/database/repositories/drizzle-analise-repository", () => ({
  drizzleAnaliseRepository: mocks.analise,
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

import DashboardPage from "./page";

const RESUMO_VENDEDOR: ResumoDoVendedor = {
  totalItens: 4,
  itensAtivos: 2,
  valorListado: 15000,
  itensPorStatus: [
    { status: "active", total: 2 },
    { status: "draft", total: 2 },
  ],
  itensPorTipo: [{ tipo: "product", total: 4 }],
  maisDisputados: [{ id: "i1", title: "Console retrô", lances: 4, maiorLance: 7000 }],
};

const SERIES: SeriesDoVendedor = {
  lancesPorDia: [{ dia: "2026-09-29", total: 4 }],
  itensCriadosPorDia: [{ dia: "2026-09-29", total: 1 }],
};

const RESUMO_COMPRADOR: ResumoDoComprador = {
  totalLances: 5,
  itensAcompanhados: 2,
  liderando: 3,
  superado: 2,
  lancesPorDia: [{ dia: "2026-09-29", total: 5 }],
  recentes: [
    {
      id: "b1",
      itemId: "i1",
      itemTitle: "Console retrô",
      vendedorSlug: "loja-da-ana",
      amount: 7000,
      createdAt: new Date("2026-09-29T12:00:00Z"),
      liderando: true,
    },
  ],
};

function props(periodo?: string) {
  return { params: Promise.resolve({}), searchParams: Promise.resolve(periodo ? { periodo } : {}) };
}

describe("dashboard/page — a visao segue o papel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.analise.resumoDoVendedor.mockResolvedValue(RESUMO_VENDEDOR);
    mocks.analise.seriesDoVendedor.mockResolvedValue(SERIES);
    mocks.analise.resumoDoComprador.mockResolvedValue(RESUMO_COMPRADOR);
  });

  // ponytail: a tela e SERVER, mas os graficos sao CLIENT (`recharts`). O
  // `renderToStaticMarkup` renderiza a arvore toda do servidor — o que prova que
  // a fronteira `use client` foi montada no lugar certo (dados para dentro, nada
  // de `window`), e nao so que a pagina retorna um objeto.
  it("seller recebe os indicadores, os graficos e o ranking", async () => {
    mocks.sessao.mockResolvedValue({ user: { id: "u1", name: "Ana", email: "ana@ex.com", role: "seller" } });
    const html = renderToStaticMarkup(await DashboardPage(props()));

    expect(html).toContain("Seu painel");
    expect(html).toContain("Itens no total");
    expect(html).toContain("Console retrô");
    expect(html).toContain("4");
    // a vitrine de comprador nao pode vazar para o vendedor
    expect(html).not.toContain("Meus lances recentes");
  });

  it("both cai na visao de vendedor", async () => {
    mocks.sessao.mockResolvedValue({ user: { id: "u1", name: "Ana", email: "ana@ex.com", role: "both" } });
    const html = renderToStaticMarkup(await DashboardPage(props()));
    expect(html).toContain("Seu painel");
    expect(mocks.analise.resumoDoVendedor).toHaveBeenCalledWith("u1");
    expect(mocks.analise.resumoDoComprador).not.toHaveBeenCalled();
  });

  it("bidder recebe a visao de lances e o link do item leva o slug do vendedor", async () => {
    mocks.sessao.mockResolvedValue({ user: { id: "u9", name: "Bia", email: "bia@ex.com", role: "bidder" } });
    const html = renderToStaticMarkup(await DashboardPage(props()));

    expect(html).toContain("Meus lances");
    expect(html).toContain("Seus lances recentes");
    // a rota publica e /[slug]/[itemId] e o `getItemBySlugAndId` recusa o slug
    // errado — um href `/${itemId}` daria 404
    expect(html).toContain("/loja-da-ana/i1");
    expect(mocks.analise.resumoDoVendedor).not.toHaveBeenCalled();
  });

  // ponytail: o papel vem do better-auth como `string`, nao como a union do
  // dominio. Um papel desconhecido tem que cair no ramo MENOS privilegiado — a
  // visao de comprador. O inverso mostraria um painel vazio com cara de bug.
  it("papel desconhecido cai na visao de comprador, nao na de vendedor", async () => {
    mocks.sessao.mockResolvedValue({ user: { id: "u1", name: "X", email: "x@ex.com", role: "admin" } });
    const html = renderToStaticMarkup(await DashboardPage(props()));
    expect(html).toContain("Meus lances");
    expect(mocks.analise.resumoDoVendedor).not.toHaveBeenCalled();
  });

  it("sem sessao nao renderiza nada nem consulta a analise", async () => {
    mocks.sessao.mockResolvedValue(null);
    expect(await DashboardPage(props())).toBeNull();
    expect(mocks.analise.resumoDoVendedor).not.toHaveBeenCalled();
    expect(mocks.analise.resumoDoComprador).not.toHaveBeenCalled();
  });
});

describe("dashboard/page — o periodo vem da URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.analise.resumoDoVendedor.mockResolvedValue(RESUMO_VENDEDOR);
    mocks.analise.seriesDoVendedor.mockResolvedValue(SERIES);
  });

  it.each([
    ["7d", 7],
    ["30d", 30],
    ["90d", 90],
  ])("?periodo=%s chega na consulta como %i dias", async (chave, dias) => {
    mocks.sessao.mockResolvedValue({ user: { id: "u1", name: "Ana", email: "a@e.com", role: "seller" } });
    await DashboardPage(props(chave));
    expect(mocks.analise.seriesDoVendedor).toHaveBeenCalledWith("u1", dias);
  });

  it("sem ?periodo usa 30 dias", async () => {
    mocks.sessao.mockResolvedValue({ user: { id: "u1", name: "Ana", email: "a@e.com", role: "seller" } });
    await DashboardPage(props());
    expect(mocks.analise.seriesDoVendedor).toHaveBeenCalledWith("u1", 30);
  });

  // ponytail: `?periodo=lixo` NAO pode virar 404 nem um intervalo arbitrario.
  // A leitura e do `interpretarPeriodo` (testado la); aqui so interessa o
  // efeito colateral — um valor malformado que escapasse chegaria ao
  // `date_trunc` do Postgres e viraria "todos os dias, sempre".
  it("?periodo invalido cai no padrao de 30 dias", async () => {
    mocks.sessao.mockResolvedValue({ user: { id: "u1", name: "Ana", email: "a@e.com", role: "seller" } });
    await DashboardPage(props(";drop table items"));
    expect(mocks.analise.seriesDoVendedor).toHaveBeenCalledWith("u1", 30);
  });

  it("?periodo repetido usa o primeiro valor, como o URLSearchParams.get", async () => {
    mocks.sessao.mockResolvedValue({ user: { id: "u1", name: "Ana", email: "a@e.com", role: "seller" } });
    await DashboardPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ periodo: ["7d", "90d"] }) });
    expect(mocks.analise.seriesDoVendedor).toHaveBeenCalledWith("u1", 7);
  });
});
