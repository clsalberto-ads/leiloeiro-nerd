import { describe, it, expect } from "vitest";
import { drizzleBidStatsList, nextRank, toStats } from "./drizzle-bid-repository";

describe("drizzleBidRepository", () => {
  it("nextRank = 1 quando não há lance anterior (sem lock, primeiro lance)", () => {
    expect(nextRank(null)).toBe(1);
  });

  it("nextRank = N+1 em relação ao maior lance atual", () => {
    expect(nextRank(1)).toBe(2);
    expect(nextRank(7)).toBe(8);
  });
});

// ponytail: `paraEstatisticas` e a funcao pura que o teste alcanca, e ela existe
// por um motivo concreto: `ofManyItems` faz I/O, e um teste de I/O aqui
// precisaria de banco. A transformacao "linhas do GROUP BY -> Map" e a parte que
// tem regra (a ABSENCAO no mapa e o `highestBid === null`, e nao uma linha com
// zero), entao e ela que o teste trava.
describe("paraEstatisticas", () => {
  it("agrupa as linhas por item", () => {
    const mapa = toStats([
      { itemId: "i1", total: 3, highestBid: 28080 },
      { itemId: "i2", total: 1, highestBid: 10000 },
    ]);
    expect(mapa.get("i1")).toEqual({ total: 3, highestBid: 28080 });
    expect(mapa.get("i2")).toEqual({ total: 1, highestBid: 10000 });
  });

  it("item sem lance NAO entra no mapa — a ausencia e o highestBid === null", () => {
    const mapa = toStats([{ itemId: "i1", total: 1, highestBid: 500 }]);
    expect(mapa.has("i2")).toBe(false);
  });

  it("lista vazia devolve mapa vazio", () => {
    expect(toStats([]).size).toBe(0);
  });

  it("`total` vindo como texto do `pg` vira numero, e nao a string", () => {
    // o `pg` entrega `bigint` como TEXTO e a assinatura declara `number` porque e
    // o que o `sql<number>` promete — o cast forja a discrepancia que o banco
    // produz, e e ela que o `Number()` existe para absorber.
    const linhas = [{ itemId: "i1", total: "3" as unknown as number, highestBid: 28080 }];
    expect(toStats(linhas).get("i1")).toEqual({ total: 3, highestBid: 28080 });
  });

  it("`highestBid: null` continua null: `Number(null)` seria 0, e 0 e um lance", () => {
    const mapa = toStats([{ itemId: "i1", total: 0, highestBid: null }]);
    expect(mapa.get("i1")).toEqual({ total: 0, highestBid: null });
  });
});

// ponytail: este caso e sobre a GUARDA, e nao sobre o `Map`: o `paraEstatisticas([])`
// acima passa com a guarda apagada. Aqui a promessa e "sem itens, sem consulta" —
// que e a unica forma de ela virar vermelho e travar, num ambiente de teste que
// nao tem banco.
describe("drizzleBidStatsList", () => {
  it("lista vazia devolve mapa vazio sem tocar no banco", async () => {
    expect(await drizzleBidStatsList.ofManyItems([])).toEqual(new Map());
  });
});