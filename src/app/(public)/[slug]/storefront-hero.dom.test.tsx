import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { SellerStorefront } from "@/domain/repositories/user-repository";
import { StorefrontHero } from "./storefront-hero";

const BASE: SellerStorefront = {
  id: "u1", name: "Ana Impala", slug: "ana", image: null,
  createdAt: new Date("2026-01-15T12:00:00Z"), activeItemCount: 12,
};

const html = (over: Partial<SellerStorefront> = {}) => renderToString(<StorefrontHero seller={{ ...BASE, ...over }} />);

describe("StorefrontHero", () => {
  it("mostra o nome, o total de itens e a data de entrada", () => {
    const output = html();
    expect(output).toContain("Ana Impala");
    expect(output).toContain("12 itens em leilão");
    expect(output).toContain("Janeiro de 2026");
  });

  it("pluraliza o total de itens", () => {
    expect(html({ activeItemCount: 1 })).toContain("1 item em leilão");
    expect(html({ activeItemCount: 0 })).toContain("Nenhum item em leilão");
  });

  it("a data de entrada e formatada no fuso do produto, em pt-BR", () => {
    const output = html({ createdAt: new Date("2026-01-15T23:30:00Z") });
    // 2026-01-15T23:30Z == 15/01 20:30 em America/Sao_Paulo — o mesmo dia.
    // O mes vem por extenso do Intl em pt-BR (nada de array de meses a mao, que
    // envelheceria com o `Intl` do runtime) e com a inicial maiuscula, que e a
    // forma que o leitor ve no "Membro desde".
    expect(output).toContain("Janeiro de 2026");
  });

  it("SEM selo de 'verificado': a vitrine mostra so fato verificavel", () => {
    const output = html();
    expect(output).not.toMatch(/verificad/i);
    expect(output).not.toMatch(/confiável|confiavel/i);
  });

  it("sem avatar: as iniciais do nome, que e o que o banco de dev tem", () => {
    expect(html({ image: null })).toContain("AI");
  });

  it("com avatar: a img tem o nome como alt", () => {
    const output = html({ image: "https://cdn.ex.com/ana.jpg" });
    expect(output).toContain('alt="Ana Impala"');
  });

  it("o nome aparece em h1: e o landmark que o leitor de tela pula primeiro", () => {
    expect(html()).toContain("<h1");
  });
});