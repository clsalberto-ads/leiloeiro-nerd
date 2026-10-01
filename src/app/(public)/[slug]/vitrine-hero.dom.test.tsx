import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { VitrineDeVendedor } from "@/domain/repositories/user-repository";
import { VitrineHero } from "./vitrine-hero";

const BASE: VitrineDeVendedor = {
  id: "u1", name: "Ana Impala", slug: "ana", image: null,
  criadoEm: new Date("2026-01-15T12:00:00Z"), totalDeItensAtivos: 12,
};

const html = (over: Partial<VitrineDeVendedor> = {}) => renderToString(<VitrineHero vendedor={{ ...BASE, ...over }} />);

describe("VitrineHero", () => {
  it("mostra o nome, o total de itens e a data de entrada", () => {
    const saida = html();
    expect(saida).toContain("Ana Impala");
    expect(saida).toContain("12 itens em leilão");
    expect(saida).toContain("Janeiro de 2026");
  });

  it("pluraliza o total de itens", () => {
    expect(html({ totalDeItensAtivos: 1 })).toContain("1 item em leilão");
    expect(html({ totalDeItensAtivos: 0 })).toContain("Nenhum item em leilão");
  });

  it("a data de entrada e formatada no fuso do produto, em pt-BR", () => {
    const saida = html({ criadoEm: new Date("2026-01-15T23:30:00Z") });
    // 2026-01-15T23:30Z == 15/01 20:30 em America/Sao_Paulo — o mesmo dia.
    // O mes vem por extenso do Intl em pt-BR (nada de array de meses a mao, que
    // envelheceria com o `Intl` do runtime) e com a inicial maiuscula, que e a
    // forma que o leitor ve no "Membro desde".
    expect(saida).toContain("Janeiro de 2026");
  });

  it("SEM selo de 'verificado': a vitrine mostra so fato verificavel", () => {
    const saida = html();
    expect(saida).not.toMatch(/verificad/i);
    expect(saida).not.toMatch(/confiável|confiavel/i);
  });

  it("sem avatar: as iniciais do nome, que e o que o banco de dev tem", () => {
    expect(html({ image: null })).toContain("AI");
  });

  it("com avatar: a img tem o nome como alt", () => {
    const saida = html({ image: "https://cdn.ex.com/ana.jpg" });
    expect(saida).toContain('alt="Ana Impala"');
  });

  it("o nome aparece em h1: e o landmark que o leitor de tela pula primeiro", () => {
    expect(html()).toContain("<h1");
  });
});