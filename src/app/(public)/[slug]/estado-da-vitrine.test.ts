import { describe, expect, it } from "vitest";
import {
  VISTA_PADRAO_DA_VITRINE,
  hrefDaVista,
  interpretarVitrine,
  type OrdenacaoDaVitrine,
} from "./estado-da-vitrine";

// ponytail: o `escrever` monta a `URLSearchParams` e devolve um `buscar` que le
// dela. E o par inverso do `interpretarVitrine` (que recebe o `buscar` do Next),
// e e por isso que o round-trip do fim do arquivo fecha sem adaptador: a funcao que
// escreve a URL e a mesma que a le, entao `ler(emitir(v)) === emitir(v)` para
// toda vista.
function escrever(url: string): (nome: string) => string | null {
  const p = new URL(url, "https://ex.com").searchParams;
  return (nome) => p.get(nome);
}

describe("interpretarVitrine", () => {
  it("sem parametros devolve a vista padrao: sem busca, terminating primeiro", () => {
    expect(interpretarVitrine(escrever("/ana"))).toEqual(VISTA_PADRAO_DA_VITRINE);
    expect(VISTA_PADRAO_DA_VITRINE).toEqual({ q: "", ordenar: "prazo" });
  });

  it("le a busca e apara as pontas", () => {
    expect(interpretarVitrine(escrever("/ana?q=%20%20console%20%20")).q).toBe("console");
  });

  it("le as tres ordenacoes", () => {
    for (const ordenar of ["prazo", "lance", "recentes"] as const satisfies OrdenacaoDaVitrine[]) {
      expect(interpretarVitrine(escrever(`/ana?ordenar=${ordenar}`)).ordenar).toBe(ordenar);
    }
  });

  it("ordenar invalido cai no padrao, e nao em erro nem em indefinido", () => {
    expect(interpretarVitrine(escrever("/ana?ordenar=%3Bdrop")).ordenar).toBe("prazo");
    expect(interpretarVitrine(escrever("/ana?ordenar=")).ordenar).toBe("prazo");
    expect(interpretarVitrine(escrever("/ana?ordenar=preco")).ordenar).toBe("prazo");
  });
});

describe("hrefDaVista", () => {
  it("a vista padrao e o caminho puro, sem query", () => {
    expect(hrefDaVista("ana", VISTA_PADRAO_DA_VITRINE)).toBe("/ana");
  });

  it("escreve o slug no caminho e a query depois", () => {
    expect(hrefDaVista("ana-impala", { q: "console", ordenar: "lance" })).toBe(
      "/ana-impala?q=console&ordenar=lance",
    );
  });

  it("nao escreve o que ja e o padrao", () => {
    expect(hrefDaVista("ana", { q: "", ordenar: "prazo" })).toBe("/ana");
  });

  it("escreve apenas a ordenacao quando nao ha busca", () => {
    expect(hrefDaVista("ana", { q: "", ordenar: "recentes" })).toBe("/ana?ordenar=recentes");
  });

  it("codifica a busca: espaco vira %20 e nao +, e & nao injeta parametro", () => {
    const href = hrefDaVista("ana", { q: "a b&c=d", ordenar: "prazo" });
    expect(href).toBe("/ana?q=a%20b%26c%3Dd");
    expect(new URLSearchParams(href.split("?")[1]).get("q")).toBe("a b&c=d");
  });
});

// ponytail: o round-trip e o que trava a invariante que o `estado-da-tabela.ts`
// tambem trava: duas vistas iguais produzem a MESMA string, que e o que faz
// "copiar e colar o link" funcionar e o botao "voltar" desfazer a coisa certa.
describe("round-trip: ler o que foi escrito devolve a mesma vista", () => {
  const vistas = [
    { q: "", ordenar: "prazo" },
    { q: "console", ordenar: "prazo" },
    { q: "", ordenar: "lance" },
    { q: "", ordenar: "recentes" },
    { q: "jogo raro", ordenar: "recentes" },
    { q: "a&b c", ordenar: "lance" },
  ] as const;

  for (const vista of vistas) {
    it(`${JSON.stringify(vista)} sobrevive a emitir e ler`, () => {
      const href = hrefDaVista("ana", vista);
      expect(interpretarVitrine(escrever(href))).toEqual(vista);
      expect(hrefDaVista("ana", interpretarVitrine(escrever(href)))).toBe(href);
    });
  }
});
