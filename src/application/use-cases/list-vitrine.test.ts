import { describe, expect, it } from "vitest";
import { listVitrine, ordenarParaVitrine } from "./list-vitrine";
import type { Item, ItemDaVitrine, ItemListFilter } from "@/domain/repositories/item-repository";
import type { EstatisticasDeLance, EstatisticasDeLances } from "@/domain/repositories/bid-repository";
import type { VistaDaVitrine } from "@/app/(public)/[slug]/estado-da-vitrine";

const VISTA: VistaDaVitrine = { q: "", ordenar: "prazo" };

function item(id: string, over: Partial<Item> = {}): Item {
  return {
    id, sellerId: "u1", title: `Item ${id}`, description: "texto longo",
    type: "product", imageUrl: null, minInitialBid: 1000, minBidIncrement: 100,
    bidDeadline: new Date("2026-10-10T12:00:00Z"), paymentDeadlineDays: 3,
    status: "active", createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"), ...over,
  };
}

function vitrineItem(id: string, maior: number | null, over: Partial<ItemDaVitrine> = {}): ItemDaVitrine {
  return {
    id, title: `Item ${id}`, type: "product", minInitialBid: 1000,
    bidDeadline: new Date("2026-10-10T12:00:00Z"), imageUrl: null,
    totalDeLances: maior === null ? 0 : 1, maiorLance: maior, ...over,
  };
}

const SEM_LANCE = new Map<string, EstatisticasDeLance>();

describe("ordenarParaVitrine", () => {
  it("por prazo: o que encerra primeiro vem primeiro", () => {
    const a = vitrineItem("a", 10, { bidDeadline: new Date("2026-10-01T12:00:00Z") });
    const b = vitrineItem("b", 99, { bidDeadline: new Date("2026-11-01T12:00:00Z") });
    expect(ordenarParaVitrine([b, a], "prazo").map((i) => i.id)).toEqual(["a", "b"]);
  });

  // ponytail: ESTE e o `it` que trava a decisao do usuario — "o maior lance deve
  // ter sempre a primeira posicao". O `b` tem o maior valor (99) e a `a` nao
  // (10), e a ordem observada e [b, a].
  it("por lance: o MAIOR lance real vem primeiro, nao o lance inicial", () => {
    const a = vitrineItem("a", 10, { minInitialBid: 999999 });
    const b = vitrineItem("b", 99, { minInitialBid: 1 });
    expect(ordenarParaVitrine([a, b], "lance").map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("por lance: item SEM lance vai para o FIM, nunca para o topo", () => {
    const semLances = vitrineItem("sem", null);
    const comLances = vitrineItem("com", 1);
    expect(ordenarParaVitrine([semLances, comLances], "lance").map((i) => i.id)).toEqual(["com", "sem"]);
    expect(ordenarParaVitrine([comLances, semLances], "lance").map((i) => i.id)).toEqual(["com", "sem"]);
  });

  it("por lance: empate desempata pelo prazo, que e a ordem do resto da tela", () => {
    const tarde = vitrineItem("tarde", 50, { bidDeadline: new Date("2026-12-01T12:00:00Z") });
    const cedo = vitrineItem("cedo", 50, { bidDeadline: new Date("2026-10-01T12:00:00Z") });
    expect(ordenarParaVitrine([tarde, cedo], "lance").map((i) => i.id)).toEqual(["cedo", "tarde"]);
  });

  it("por recentes: o mais novo primeiro", () => {
    const velho = vitrineItem("velho", 1, { title: "x" });
    const novos = vitrineItem("novo", 1);
    // createdAt nao esta no DTO; o desempate de "recentes" usa o id como
    // substituto estavel — ver a nota do comparador na implementacao.
    expect(ordenarParaVitrine([novos, velho], "recentes").map((i) => i.id)).toEqual(["novo", "velho"]);
  });

  it("a lista original nao e mutada (o .sort() do array recebido seria um bug)", () => {
    const original = [vitrineItem("a", 1), vitrineItem("b", 5)];
    const copia = [...original];
    ordenarParaVitrine(original, "lance");
    expect(original).toEqual(copia);
  });
});

describe("listVitrine", () => {
  it("busca so os itens ATIVOS, sempre", async () => {
    const filtros: unknown[] = [];
    const itemRepo = { async findBySellerId(_: string, f?: unknown) { filtros.push(f); return []; } };
    await listVitrine(itemRepo as never, { async deVariosItens() { return SEM_LANCE; } }, "u1", VISTA);
    expect(filtros[0]).toEqual({ status: "active" });
  });

  it("repassa a busca da URL para o filtro do repositorio", async () => {
    const filtros: (ItemListFilter | undefined)[] = [];
    const itemRepo = { async findBySellerId(_: string, f?: ItemListFilter) { filtros.push(f); return []; } };
    await listVitrine(itemRepo as never, { async deVariosItens() { return SEM_LANCE; } }, "u1",
      { q: "console", ordenar: "prazo" });
    expect(filtros[0]).toEqual({ status: "active", q: "console" });
  });

  it("NÃO passa orderBy: a ordenacao e em JS, e nao no SQL", async () => {
    const filtros: (ItemListFilter | undefined)[] = [];
    const itemRepo = { async findBySellerId(_: string, f?: ItemListFilter) { filtros.push(f); return []; } };
    await listVitrine(itemRepo as never, { async deVariosItens() { return SEM_LANCE; } }, "u1",
      { q: "", ordenar: "lance" });
    expect(filtros[0]!.orderBy).toBeUndefined();
    expect(filtros[0]!.direction).toBeUndefined();
  });

  it("carrega as estatisticas dos itens numa unica chamada em lote", async () => {
    const pedidos: string[][] = [];
    const lances: EstatisticasDeLances = {
      async deVariosItens(ids) { pedidos.push(ids); return new Map([["i1", { total: 2, maior: 700 }]]); },
    };
    const itemRepo = { async findBySellerId() { return [item("i1"), item("i2")]; } };
    await listVitrine(itemRepo as never, lances, "u1", VISTA);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toEqual(["i1", "i2"]);
  });

  it("projeta no DTO: o maior lance do mapa entra no card", async () => {
    const lances = { async deVariosItens() { return new Map([["i1", { total: 2, maior: 700 }]]); } };
    const itemRepo = { async findBySellerId() { return [item("i1")]; } };
    const [primeiro] = await listVitrine(itemRepo as never, lances, "u1", VISTA);
    expect(primeiro.maiorLance).toBe(700);
    expect(primeiro.totalDeLances).toBe(2);
  });

  it("item ausente do mapa de lances vira maiorLance null e totalDeLances 0", async () => {
    const lances = { async deVariosItens() { return SEM_LANCE; } };
    const itemRepo = { async findBySellerId() { return [item("i1")]; } };
    const [primeiro] = await listVitrine(itemRepo as never, lances, "u1", VISTA);
    expect(primeiro.maiorLance).toBeNull();
    expect(primeiro.totalDeLances).toBe(0);
  });

  it("vitrine vazia nao chama o repositorio de lances", async () => {
    let chamou = false;
    const lances: EstatisticasDeLances = { async deVariosItens() { chamou = true; return SEM_LANCE; } };
    const itemRepo = { async findBySellerId() { return []; } };
    expect(await listVitrine(itemRepo as never, lances, "u1", VISTA)).toEqual([]);
    expect(chamou).toBe(false);
  });

  it("o DTO nao carrega `description`: o texto longo nao atravessa o payload do RSC", async () => {
    const lances = { async deVariosItens() { return SEM_LANCE; } };
    const itemRepo = { async findBySellerId() { return [item("i1", { description: "LONGO" })]; } };
    const [primeiro] = await listVitrine(itemRepo as never, lances, "u1", VISTA);
    expect(Object.keys(primeiro).sort()).toEqual(
      ["bidDeadline", "id", "imageUrl", "maiorLance", "minInitialBid", "title", "totalDeLances", "type"],
    );
    expect(JSON.stringify(primeiro)).not.toContain("LONGO");
  });
});