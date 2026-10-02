import { describe, expect, it } from "vitest";
import { listSellerItems } from "./list-seller-items";
import type {
  Item,
  ItemListFilter,
  ItemListResult,
  ItemLister,
  ItemOrderBy,
} from "@/domain/repositories/item-repository";

const MARCA_COMBINANTE = /\p{Diacritic}/gu;

// ponytail: este dobrao e a MESMA regra do `translate(…, COMPOSTOS, SIMPLES)` que o
// `drizzle-item-repository.ts` faz em SQL — os dois lados (coluna e termo) dobram,
// ou a busca por acento volta a depender do que o usuario digitou. Aqui o
// `NFD` + `Diacritic` faz o trabalho; la o Postgres so sabe `translate`, que e
// uma tabela fechada de 25 caracteres. Se um dia os dois divergirem, o teste de
// SQL (`strpos(lower(translate(...)))` dos dois lados) e o teste do termo com
// acento sao os dois alarme.
function stripAccents(text: string): string {
  return text.normalize("NFD").replace(MARCA_COMBINANTE, "").toLowerCase();
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "i1",
    sellerId: "u1",
    title: "Item",
    description: "descricao",
    type: "product",
    imageUrl: null,
    minInitialBid: 100,
    minBidIncrement: 100,
    bidDeadline: new Date("2026-03-01T00:00:00Z"),
    paymentDeadlineDays: 3,
    status: "draft",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

const ROWS: Item[] = [
  makeItem({
    id: "i1",
    title: "Console raro de 1989",
    minInitialBid: 1000,
    status: "draft",
    createdAt: new Date("2026-01-03T00:00:00Z"),
  }),
  makeItem({
    id: "i2",
    title: "Impressora jato",
    minInitialBid: 5000,
    status: "active",
    createdAt: new Date("2026-01-02T00:00:00Z"),
    bidDeadline: new Date("2026-02-01T00:00:00Z"),
  }),
  makeItem({
    id: "i3",
    title: "Câmera de ação 4K",
    minInitialBid: 2000,
    status: "closed",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    bidDeadline: new Date("2026-04-01T00:00:00Z"),
  }),
];

// ponytail: a comparacao de texto aqui e por ponto de codigo (`<`/`>`), e nao por
// `localeCompare`: o que ordena de verdade e o `ORDER BY` do Postgres, com a
// collacao do banco, e o `localeCompare("pt-BR")` traria uma ordem que o banco
// nao garante. Os titulos dos fixtures de ordenacao sao sem acento por isso — o
// contrato deste teste e a coluna e a direcao, nao a collacao do servidor.
const COLUNAS: Record<ItemOrderBy, (row: Item) => number | string> = {
  createdAt: (row) => row.createdAt.getTime(),
  title: (row) => row.title,
  minInitialBid: (row) => row.minInitialBid,
  bidDeadline: (row) => row.bidDeadline.getTime(),
};

function compare(a: number | string, b: number | string): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

// ponytail: sem `orderBy`, o padrao e `createdAt desc` — e nao "asc" como em
// qualquer outra coluna. Nao e assimetria por acidente: e a ordem que a
// listagem ja tinha (`orderBy(desc(items.createdAt))`) e que a vitrine publica
// depende. Ver o `ponytail:` de `DEFAULT_SORT_BY` no repositorio Drizzle.
function sort(linhas: Item[], filter?: ItemListFilter): Item[] {
  const column = COLUNAS[filter?.orderBy ?? "createdAt"];
  const direcao = filter?.orderBy === undefined || filter?.direction === "desc" ? -1 : 1;
  return [...linhas].sort((a, b) => {
    const diferenca = compare(column(a), column(b));
    return diferenca !== 0 ? diferenca * direcao : a.id < b.id ? -1 : 1;
  });
}

class FakeRepository implements ItemLister {
  receivedSeller?: string;
  receivedFilter?: ItemListFilter;
  constructor(private readonly linhas: Item[] = ROWS) {}
  async listBySellerId(sellerId: string, filter?: ItemListFilter): Promise<ItemListResult> {
    this.receivedSeller = sellerId;
    this.receivedFilter = filter;
    const termo = stripAccents(filter?.q?.trim() ?? "");
    const filtradas = this.linhas.filter((row) => {
      if (filter?.status && row.status !== filter.status) return false;
      if (termo && !stripAccents(row.title).includes(termo)) return false;
      return true;
    });
    const ordenadas = sort(filtradas, filter);
    const start = filter?.offset ?? 0;
    const limite = filter?.limit;
    const page =
      limite === undefined ? ordenadas.slice(start) : ordenadas.slice(start, start + limite);
    return { items: page, total: filtradas.length };
  }
}

function ids(items: Item[]): string[] {
  return items.map((item) => item.id);
}

describe("listSellerItems", () => {
  it("repassa o sellerId e devolve itens e total", async () => {
    const repo = new FakeRepository();
    const result = await listSellerItems(repo, "u1");
    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(3);
    expect(repo.receivedSeller).toBe("u1");
  });

  it("filtra por status quando informado", async () => {
    const repo = new FakeRepository();
    const { items, total } = await listSellerItems(repo, "u1", { status: "active" });
    expect(ids(items)).toEqual(["i2"]);
    expect(total).toBe(1);
    expect(repo.receivedFilter).toEqual({ status: "active" });
  });

  it("ordena por lance mínimo quando solicitado", async () => {
    const repo = new FakeRepository();
    const { items } = await listSellerItems(repo, "u1", { orderBy: "minInitialBid", direction: "asc" });
    expect(items.map((i) => i.minInitialBid)).toEqual([1000, 2000, 5000]);
  });

  it("filtra por busca textual no título", async () => {
    const repo = new FakeRepository();
    const { items, total } = await listSellerItems(repo, "u1", { q: "raro" });
    expect(ids(items)).toEqual(["i1"]);
    expect(total).toBe(1);
  });

  it("pagina com limit e offset", async () => {
    const repo = new FakeRepository();
    const primeira = await listSellerItems(repo, "u1", { limit: 1, offset: 0 });
    const segunda = await listSellerItems(repo, "u1", { limit: 1, offset: 1 });
    expect(primeira.items).toHaveLength(1);
    expect(primeira.total).toBe(3);
    expect(segunda.total).toBe(3);
    expect(ids(primeira.items)).not.toEqual(ids(segunda.items));
  });

  it("devolve o total do conjunto filtrado, e não o total da tabela", async () => {
    const repo = new FakeRepository();
    const byStatus = await listSellerItems(repo, "u1", { status: "draft" });
    const bySearch = await listSellerItems(repo, "u1", { q: "raro", limit: 1 });
    expect(ids(byStatus.items)).toEqual(["i1"]);
    expect(byStatus.total).toBe(1);
    expect(bySearch.total).toBe(1);
  });

  it("total ignora o limit: a página conta contra o conjunto filtrado inteiro", async () => {
    const repo = new FakeRepository();
    const { items, total } = await listSellerItems(repo, "u1", { limit: 1 });
    expect(items).toHaveLength(1);
    expect(total).toBe(3);
  });

  it("busca que não casa com nada devolve lista vazia e total zero", async () => {
    const repo = new FakeRepository();
    const { items, total } = await listSellerItems(repo, "u1", { q: "teclado" });
    expect(items).toEqual([]);
    expect(total).toBe(0);
  });

  it("busca casa sem acento, como o usuário digita", async () => {
    const repo = new FakeRepository();
    const sem = await listSellerItems(repo, "u1", { q: "acao" });
    const withView = await listSellerItems(repo, "u1", { q: "Ação" });
    expect(ids(sem.items)).toEqual(["i3"]);
    expect(ids(withView.items)).toEqual(["i3"]);
  });
  it("inverte a ordem quando a direção é desc", async () => {
    const repo = new FakeRepository();
    const crescente = await listSellerItems(repo, "u1", { orderBy: "minInitialBid", direction: "asc" });
    const decrescente = await listSellerItems(repo, "u1", { orderBy: "minInitialBid", direction: "desc" });
    expect(ids(crescente.items)).toEqual(["i1", "i3", "i2"]);
    expect(ids(decrescente.items)).toEqual(["i2", "i3", "i1"]);
  });

  it("ordena por prazo, a coluna que não tem accessFn de servidor na union do brief", async () => {
    const repo = new FakeRepository();
    const { items } = await listSellerItems(repo, "u1", { orderBy: "bidDeadline", direction: "asc" });
    expect(ids(items)).toEqual(["i2", "i1", "i3"]);
  });

  it("sem orderBy vem o mais recente primeiro, como a listagem já fazia", async () => {
    const repo = new FakeRepository();
    const { items } = await listSellerItems(repo, "u1");
    expect(ids(items)).toEqual(["i1", "i2", "i3"]);
  });

  it("sem direção explícita, a coluna pedida vem em asc", async () => {
    const repo = new FakeRepository([
      makeItem({ id: "i9", title: "Bbb" }),
      makeItem({ id: "i7", title: "Aaa" }),
      makeItem({ id: "i8", title: "Ccc" }),
    ]);
    const { items } = await listSellerItems(repo, "u1", { orderBy: "title" });
    expect(ids(items)).toEqual(["i7", "i9", "i8"]);
  });

  it("desempata pelo id quando o valor da coluna é igual", async () => {
    const mesmo = new Date("2026-01-01T00:00:00Z");
    const repo = new FakeRepository([
      makeItem({ id: "i9", title: "Bbb", minInitialBid: 500, createdAt: mesmo }),
      makeItem({ id: "i7", title: "Aaa", minInitialBid: 500, createdAt: mesmo }),
    ]);
    const { items } = await listSellerItems(repo, "u1", { orderBy: "minInitialBid", direction: "asc" });
    expect(ids(items)).toEqual(["i7", "i9"]);
  });

  it("offset além do fim devolve lista vazia, sem perder o total", async () => {
    const repo = new FakeRepository();
    const { items, total } = await listSellerItems(repo, "u1", { limit: 2, offset: 99 });
    expect(items).toEqual([]);
    expect(total).toBe(3);
  });

  it("sem limit, devolve o conjunto inteiro e o total bate com items", async () => {
    const repo = new FakeRepository();
    const { items, total } = await listSellerItems(repo, "u1", { status: "draft" });
    expect(items).toHaveLength(total);
  });

  it("trunca limit e offset fracionários", async () => {
    const repo = new FakeRepository();
    await listSellerItems(repo, "u1", { limit: 2.9, offset: 10.7 });
    expect(repo.receivedFilter).toEqual({ limit: 2, offset: 10 });
  });

  it("trunca limit para baixo, e apaga o que não é número", async () => {
    const repo = new FakeRepository();
    await listSellerItems(repo, "u1", { limit: 2.9 });
    expect(repo.receivedFilter).toEqual({ limit: 2 });
    await listSellerItems(repo, "u1", { limit: -5 });
    expect(repo.receivedFilter).toEqual({});
    await listSellerItems(repo, "u1", { limit: Number.NaN, offset: Number.POSITIVE_INFINITY });
    expect(repo.receivedFilter).toEqual({});
  });

  it("offset negativo vira a primeira página, e offset zero sobrevive", async () => {
    const repo = new FakeRepository();
    await listSellerItems(repo, "u1", { offset: -1 });
    expect(repo.receivedFilter).toEqual({ offset: 0 });
    const primeira = await listSellerItems(repo, "u1", { offset: 0 });
    expect(repo.receivedFilter).toEqual({ offset: 0 });
    expect(ids(primeira.items)).toEqual(["i1", "i2", "i3"]);
  });

  it("apaga q em branco ou só com espaços, em vez de procurar por espaços", async () => {
    const repo = new FakeRepository();
    const { items, total } = await listSellerItems(repo, "u1", { q: "   ", status: "active" });
    expect(repo.receivedFilter).toEqual({ status: "active" });
    expect(ids(items)).toEqual(["i2"]);
    expect(total).toBe(1);
  });

  it("normaliza q com espaços em volta antes de repassar", async () => {
    const repo = new FakeRepository();
    const { items } = await listSellerItems(repo, "u1", { q: "  raro  " });
    expect(repo.receivedFilter).toEqual({ q: "raro" });
    expect(ids(items)).toEqual(["i1"]);
  });

  it("repassa o filtro intacto quando não há nada para normalizar", async () => {
    const repo = new FakeRepository();
    const itemFilter: ItemListFilter = { status: "closed", orderBy: "title", direction: "asc", limit: 5, offset: 0 };
    await listSellerItems(repo, "u1", itemFilter);
    expect(repo.receivedFilter).toBe(itemFilter);
  });
});
