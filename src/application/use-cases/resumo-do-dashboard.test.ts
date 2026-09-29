import { describe, expect, it, vi } from "vitest";
import { resumoDoDashboard } from "./resumo-do-dashboard";
import type { AnaliseRepository, ResumoDoComprador, ResumoDoVendedor, SeriesDoVendedor } from "@/domain/repositories/analise-repository";

const RESUMO_VENDEDOR: ResumoDoVendedor = {
  totalItens: 3,
  itensAtivos: 2,
  valorListado: 15000,
  itensPorStatus: [{ status: "active", total: 2 }],
  itensPorTipo: [{ tipo: "product", total: 3 }],
  maisDisputados: [{ id: "i1", title: "Console", lances: 4, maiorLance: 7000 }],
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
      itemTitle: "Console",
      vendedorSlug: "loja-da-ana",
      amount: 7000,
      createdAt: new Date("2026-09-29T12:00:00Z"),
      liderando: true,
    },
  ],
};

function fake(): AnaliseRepository & { chamadas: string[] } {
  const chamadas: string[] = [];
  return {
    chamadas,
    async resumoDoVendedor(id) {
      chamadas.push(`resumoDoVendedor:${id}`);
      return RESUMO_VENDEDOR;
    },
    async seriesDoVendedor(id, dias) {
      chamadas.push(`seriesDoVendedor:${id}:${dias}`);
      return SERIES;
    },
    async resumoDoComprador(id, dias) {
      chamadas.push(`resumoDoComprador:${id}:${dias}`);
      return RESUMO_COMPRADOR;
    },
  };
}

describe("resumoDoDashboard", () => {
  // ponytail: `both` vai para o ramo do VENDEDOR, e nao para um "os dois" — quem
  // tem os dois papeis tem itens E da lances, e os dois conjuntos vivem lado a
  // lado. Este e o teste que trava essa escolha: trocar por um terceiro ramo
  // entregaria uma tela nova e sem dono.
  it.each(["seller", "both"] as const)("papel %s recebe a visao de vendedor", async (papel) => {
    const analise = fake();
    const visao = await resumoDoDashboard(analise, "u1", papel, 30);
    expect(visao.papel).toBe("vendedor");
    expect(analise.chamadas).toEqual(["resumoDoVendedor:u1", "seriesDoVendedor:u1:30"]);
  });

  it("papel bidder recebe a visao de comprador e nao toca em seller", async () => {
    const analise = fake();
    const visao = await resumoDoDashboard(analise, "u1", "bidder", 30);
    expect(visao.papel).toBe("comprador");
    expect(analise.chamadas).toEqual(["resumoDoComprador:u1:30"]);
  });

  it("repassa o periodo como dias, e nao a chave do URL", async () => {
    const analise = fake();
    await resumoDoDashboard(analise, "u1", "seller", 7);
    expect(analise.chamadas).toContain("seriesDoVendedor:u1:7");
  });

  // ponytail: `janela` e defensivo porque e o UNICO lugar entre o
  // `?periodo` da URL e o `date_trunc` do Postgres. O `interpretarPeriodo` ja so
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
  ])("um dias degenerado (%o) nao vira janela maior que 366", async (entrada, esperado) => {
    const analise = fake();
    await resumoDoDashboard(analise, "u1", "bidder", entrada);
    expect(analise.chamadas[0]).toBe(`resumoDoComprador:u1:${esperado}`);
  });

  it("nao faz a consulta de vendedor para quem so compra", async () => {
    const analise = fake();
    const spy = vi.spyOn(analise, "resumoDoVendedor");
    await resumoDoDashboard(analise, "u1", "bidder", 30);
    expect(spy).not.toHaveBeenCalled();
  });
});
