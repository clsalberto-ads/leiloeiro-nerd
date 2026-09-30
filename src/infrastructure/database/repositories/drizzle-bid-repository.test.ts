import { describe, it, expect } from "vitest";
import { nextRank, paraEstatisticas } from "./drizzle-bid-repository";

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
// por um motivo concreto: `deVariosItens` faz I/O, e um teste de I/O aqui
// precisaria de banco. A transformacao "linhas do GROUP BY -> Map" e a parte que
// tem regra (a ABSENCAO no mapa e o `maiorLance === null`, e nao uma linha com
// zero), entao e ela que o teste trava.
describe("paraEstatisticas", () => {
  it("agrupa as linhas por item", () => {
    const mapa = paraEstatisticas([
      { itemId: "i1", total: 3, maior: 28080 },
      { itemId: "i2", total: 1, maior: 10000 },
    ]);
    expect(mapa.get("i1")).toEqual({ total: 3, maior: 28080 });
    expect(mapa.get("i2")).toEqual({ total: 1, maior: 10000 });
  });

  it("item sem lance NAO entra no mapa — a ausencia e o maior === null", () => {
    const mapa = paraEstatisticas([{ itemId: "i1", total: 1, maior: 500 }]);
    expect(mapa.has("i2")).toBe(false);
  });

  it("lista vazia devolve mapa vazio", () => {
    expect(paraEstatisticas([]).size).toBe(0);
  });
});