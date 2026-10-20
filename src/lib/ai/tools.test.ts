import { beforeEach, describe, expect, it, vi } from "vitest";

// Os módulos Drizzle reais abrem um Pool do pg ao importar; aqui só importa o contrato.
vi.mock(
  "@/infrastructure/database/repositories/drizzle-item-repository",
  () => ({ drizzleExploreLister: {} }),
);
vi.mock(
  "@/infrastructure/database/repositories/drizzle-bid-repository",
  () => ({ drizzleBidStatsList: {} }),
);

import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  createMemoizedDeps,
  executeTool,
  searchActiveItems,
  type ToolDeps,
} from "./tools";
import type { ExploreItemRow } from "@/domain/repositories/item-repository";

function row(n: number, extra: Partial<ExploreItemRow> = {}): ExploreItemRow {
  return {
    id: `item-${n}`,
    title: `Item ${n}`,
    type: "product",
    minInitialBid: 10_000,
    bidDeadline: new Date(Date.UTC(2026, 11, 1, 12, n)),
    imageUrl: null,
    createdAt: new Date(Date.UTC(2026, 10, 1, 12, n)),
    sellerSlug: "loja",
    ...extra,
  };
}

function makeDeps(
  rows: ExploreItemRow[],
  stats: Record<string, { total: number; highestBid: number | null }> = {},
) {
  const listActiveWithSeller = vi.fn(async () => rows);
  const ofManyItems = vi.fn(
    async (ids: string[]) =>
      new Map(ids.filter((id) => stats[id]).map((id) => [id, stats[id]])),
  );
  const deps: ToolDeps = {
    exploreLister: { listActiveWithSeller },
    bidStats: { ofManyItems },
  };
  return { deps, listActiveWithSeller, ofManyItems };
}

describe("search_active_items", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna os itens ativos com os campos públicos mínimos", async () => {
    const { deps } = makeDeps([row(1, { title: "Cartas raras" })], {
      "item-1": { total: 3, highestBid: 25_050 },
    });

    const result = await searchActiveItems({}, deps);

    expect(result).toEqual({
      items: [
        {
          ref: "item-1",
          title: "Cartas raras",
          type: "product",
          status: "active",
          minInitialBid: expect.stringContaining("100,00"),
          highestBid: expect.stringContaining("250,50"),
          totalBids: 3,
          bidDeadline: "2026-12-01T12:01:00.000Z",
          url: "/loja/item-1",
        },
      ],
      returned: 1,
      totalMatching: 1,
    });
  });

  it("item sem lances volta com highestBid null e totalBids 0", async () => {
    const { deps } = makeDeps([row(1)]);
    const result = await searchActiveItems({}, deps);
    expect(result).toMatchObject({
      items: [{ highestBid: null, totalBids: 0 }],
    });
  });

  it("respeita o limite padrão e o teto máximo, mesmo que o modelo peça mais", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => row(i));
    const { deps } = makeDeps(rows);

    const padrao = await searchActiveItems({}, deps);
    const alto = await searchActiveItems({ limit: 500 }, deps);
    const dois = await searchActiveItems({ limit: 2 }, deps);

    expect("items" in padrao && padrao.items).toHaveLength(DEFAULT_LIMIT);
    expect("items" in alto && alto.items).toHaveLength(MAX_LIMIT);
    expect("items" in dois && dois.items).toHaveLength(2);
    expect(alto).toMatchObject({ totalMatching: 30 });
  });

  it("busca sem resultados devolve lista vazia, sem erro", async () => {
    const { deps } = makeDeps([row(1)]);
    expect(await searchActiveItems({ query: "inexistente" }, deps)).toEqual({
      items: [],
      returned: 0,
      totalMatching: 0,
    });

    const vazio = makeDeps([]);
    expect(await searchActiveItems({}, vazio.deps)).toEqual({
      items: [],
      returned: 0,
      totalMatching: 0,
    });
    expect(vazio.ofManyItems).not.toHaveBeenCalled();
  });

  it("filtra por título sem diferenciar maiúsculas nem acentos", async () => {
    const { deps } = makeDeps([
      row(1, { title: "Coleção Pokémon" }),
      row(2, { title: "Relógio" }),
    ]);
    const result = await searchActiveItems({ query: "COLECAO pokemon" }, deps);
    expect(result).toMatchObject({ returned: 1, items: [{ ref: "item-1" }] });
  });

  it("ordena por prazo, por lances e por maior lance", async () => {
    const { deps } = makeDeps([row(1), row(2), row(3)], {
      "item-1": { total: 1, highestBid: 500 },
      "item-2": { total: 9, highestBid: 100 },
      "item-3": { total: 4, highestBid: 900 },
    });
    const refs = async (args: object) => {
      const r = await searchActiveItems(args, deps);
      return "items" in r ? r.items.map((i) => i.ref) : [];
    };
    expect(await refs({})).toEqual(["item-1", "item-2", "item-3"]);
    expect(await refs({ sort: "most_bids" })).toEqual([
      "item-2",
      "item-3",
      "item-1",
    ]);
    expect(await refs({ sort: "highest_bid" })).toEqual([
      "item-3",
      "item-1",
      "item-2",
    ]);
    expect(await refs({ sort: "recent" })).toEqual([
      "item-3",
      "item-2",
      "item-1",
    ]);
  });

  it.each([
    ["limit zero", { limit: 0 }],
    ["limit negativo", { limit: -1 }],
    ["limit fracionado", { limit: 1.5 }],
    ["limit como texto", { limit: "10" }],
    ["query longa demais", { query: "a".repeat(101) }],
    ["query não-texto", { query: 42 }],
    ["sort desconhecido", { sort: "cheapest" }],
    ["argumento extra", { status: "closed" }],
  ])("rejeita argumentos inválidos: %s", async (_nome, args) => {
    const { deps, listActiveWithSeller } = makeDeps([row(1)]);
    expect(await searchActiveItems(args, deps)).toEqual({
      error: "Argumentos inválidos para search_active_items.",
    });
    expect(listActiveWithSeller).not.toHaveBeenCalled();
  });

  it("só expõe a lista branca de campos: nada de vendedor, descrição ou ids internos", async () => {
    // Mesmo que a fonte devolvesse campos a mais, eles não podem chegar ao modelo.
    const leaky = {
      ...row(1),
      sellerId: "user-secret",
      description: "interna",
      sellerEmail: "a@b.c",
    } as ExploreItemRow;
    const { deps } = makeDeps([leaky]);

    const json = JSON.stringify(await searchActiveItems({}, deps));

    expect(json).not.toContain("user-secret");
    expect(json).not.toContain("interna");
    expect(json).not.toContain("a@b.c");
    expect(json).not.toContain("sellerId");
  });

  it("consulta somente pelo caso de uso listExploreItems (fonte única de 'ativo' e visibilidade)", async () => {
    // O filtro status='active' vive no repositório Drizzle (drizzleExploreLister);
    // aqui verificamos que a ferramenta não tem outro caminho para os dados.
    const { deps, listActiveWithSeller, ofManyItems } = makeDeps([row(1)]);
    await searchActiveItems({}, deps);
    expect(listActiveWithSeller).toHaveBeenCalledTimes(1);
    expect(ofManyItems).toHaveBeenCalledWith(["item-1"]);
  });

  it("descarta item sem slug de vendedor (evita link quebrado)", async () => {
    const { deps } = makeDeps([row(1, { sellerSlug: null })]);
    expect(await searchActiveItems({}, deps)).toMatchObject({ returned: 0 });
  });
});

describe("executeTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("recusa nomes de ferramenta não registrados", async () => {
    const { deps, listActiveWithSeller } = makeDeps([row(1)]);
    expect(await executeTool("drop_table", "{}", deps)).toEqual({
      error: "Ferramenta desconhecida.",
    });
    expect(listActiveWithSeller).not.toHaveBeenCalled();
  });

  it("trata JSON malformado como argumentos inválidos", async () => {
    const { deps } = makeDeps([row(1)]);
    expect(await executeTool("search_active_items", "{oops", deps)).toEqual({
      error: "Argumentos inválidos para search_active_items.",
    });
  });

  it("aceita argumentos vazios", async () => {
    const { deps } = makeDeps([row(1)]);
    expect(await executeTool("search_active_items", "", deps)).toMatchObject({
      returned: 1,
    });
  });

  it("falha na consulta vira erro genérico, sem detalhes internos", async () => {
    const { deps, listActiveWithSeller } = makeDeps([]);
    listActiveWithSeller.mockRejectedValue(
      new Error("connection to 10.0.0.5:5432 refused, password=hunter2"),
    );

    const result = await executeTool("search_active_items", "{}", deps);

    expect(result).toEqual({
      error: "Não foi possível consultar os itens agora.",
    });
    expect(JSON.stringify(result)).not.toContain("hunter2");
  });
});

describe("createMemoizedDeps", () => {
  it("várias buscas na mesma requisição consultam o banco uma vez só", async () => {
    const { deps, listActiveWithSeller, ofManyItems } = makeDeps([
      row(1),
      row(2),
    ]);
    const memo = createMemoizedDeps(deps);

    await searchActiveItems({ query: "item 1" }, memo);
    await searchActiveItems({ sort: "most_bids" }, memo);
    await Promise.all([
      searchActiveItems({}, memo),
      searchActiveItems({ limit: 1 }, memo),
    ]);

    expect(listActiveWithSeller).toHaveBeenCalledTimes(1);
    expect(ofManyItems).toHaveBeenCalledTimes(1);
  });

  it("não guarda falhas: a chamada seguinte tenta de novo", async () => {
    const { deps, listActiveWithSeller } = makeDeps([row(1)]);
    listActiveWithSeller.mockRejectedValueOnce(new Error("falha"));
    const memo = createMemoizedDeps(deps);

    await expect(searchActiveItems({}, memo)).rejects.toThrow("falha");
    expect(await searchActiveItems({}, memo)).toMatchObject({ returned: 1 });
    expect(listActiveWithSeller).toHaveBeenCalledTimes(2);
  });
});
