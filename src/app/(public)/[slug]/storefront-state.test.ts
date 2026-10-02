import { describe, expect, it } from "vitest";
import {
  DEFAULT_STOREFRONT_VIEW,
  buildStorefrontHref,
  parseStorefrontView,
  type StorefrontSort,
} from "./storefront-state";

// ponytail: o `escrever` monta a `URLSearchParams` e devolve um `buscar` que le
// dela. E o par inverso do `parseStorefrontView` (que recebe o `buscar` do Next),
// e e por isso que o round-trip do fim do arquivo fecha sem adaptador: a funcao que
// escreve a URL e a mesma que a le. A propriedade que vale e a da ESCRITA, que
// apara o `q` antes de codificar — `emitir(ler(emitir(v))) === emitir(v)` para toda
// `v`, ate a que chega suja. Ler nunca devolve a `v` original com os espacos: devolve
// o `q` que o servidor filtrou.
function escrever(url: string): (name: string) => string | null {
  const p = new URL(url, "https://ex.com").searchParams;
  return (name) => p.get(name);
}

describe("parseStorefrontView", () => {
  it("sem parametros devolve a vista padrao: sem busca, termina em breve primeiro", () => {
    expect(parseStorefrontView(escrever("/ana"))).toEqual(DEFAULT_STOREFRONT_VIEW);
    expect(DEFAULT_STOREFRONT_VIEW).toEqual({ q: "", sort: "prazo" });
  });

  it("le a busca e apara as pontas", () => {
    expect(parseStorefrontView(escrever("/ana?q=%20%20console%20%20")).q).toBe("console");
  });

  it("le as tres ordenacoes", () => {
    for (const sort of ["prazo", "lance", "recentes"] as const satisfies StorefrontSort[]) {
      expect(parseStorefrontView(escrever(`/ana?ordenar=${sort}`)).sort).toBe(sort);
    }
  });

  it("ordenar invalido cai no padrao, e nao em erro nem em indefinido", () => {
    expect(parseStorefrontView(escrever("/ana?ordenar=%3Bdrop")).sort).toBe("prazo");
    expect(parseStorefrontView(escrever("/ana?ordenar=")).sort).toBe("prazo");
    expect(parseStorefrontView(escrever("/ana?ordenar=preco")).sort).toBe("prazo");
  });
});

describe("buildStorefrontHref", () => {
  it("a vista padrao e o caminho puro, sem query", () => {
    expect(buildStorefrontHref("ana", DEFAULT_STOREFRONT_VIEW)).toBe("/ana");
  });

  it("escreve o slug no caminho e a query depois", () => {
    expect(buildStorefrontHref("ana-impala", { q: "console", sort: "lance" })).toBe(
      "/ana-impala?q=console&ordenar=lance",
    );
  });

  it("nao escreve o que ja e o padrao", () => {
    expect(buildStorefrontHref("ana", { q: "", sort: "prazo" })).toBe("/ana");
  });

  it("escreve apenas a ordenacao quando nao ha busca", () => {
    expect(buildStorefrontHref("ana", { q: "", sort: "recentes" })).toBe("/ana?ordenar=recentes");
  });

  it("codifica a busca: espaco vira %20 e nao +, e & nao injeta parametro", () => {
    const href = buildStorefrontHref("ana", { q: "a b&c=d", sort: "prazo" });
    expect(href).toBe("/ana?q=a%20b%26c%3Dd");
    expect(new URLSearchParams(href.split("?")[1]).get("q")).toBe("a b&c=d");
  });
});

// ponytail: o round-trip e o que trava a invariante que o `dashboard-table-state.ts`
// tambem trava: duas vistas iguais produzem a MESMA string, que e o que faz
// "copiar e colar o link" funcionar e o botao "voltar" desfazer a coisa certa.
// `emitir` apara o `q` antes de codificar, entao o endereco ja sai canonico:
// ler e reescrever nao muda nada, com `q` limpa (os seis casos acima) e com `q`
// suja (o `describe` seguinte).
describe("round-trip: ler o que foi escrito devolve a mesma vista", () => {
  const vistas = [
    { q: "", sort: "prazo" },
    { q: "console", sort: "prazo" },
    { q: "", sort: "lance" },
    { q: "", sort: "recentes" },
    { q: "jogo raro", sort: "recentes" },
    { q: "a&b c", sort: "lance" },
  ] as const;

  for (const view of vistas) {
    it(`${JSON.stringify(view)} sobrevive a emitir e ler`, () => {
      const href = buildStorefrontHref("ana", view);
      expect(parseStorefrontView(escrever(href))).toEqual(view);
      expect(buildStorefrontHref("ana", parseStorefrontView(escrever(href)))).toBe(href);
    });
  }
});

// ponytail: `q` suja e o limite honesto da invariante de cima, e ele mostra que a
// ponta que apara e a ESCRITA: a vista que sai do `buildStorefrontHref` ja vem sem espaco
// nas pontas, e por isso que ler e reescrever nao muda o endereco. O que a leitura
// devolve nunca e a `v` original com espaco — e o `q` que o servidor filtrou.
describe("round-trip com `q` suja: o `href` ja sai aparado e para em uma passada", () => {
  it("emite o `q` sem os espacos das pontas e o endereco nao muda mais", () => {
    const href = buildStorefrontHref("ana", { q: "  console  ", sort: "lance" });
    expect(href).toBe("/ana?q=console&ordenar=lance");

    expect(parseStorefrontView(escrever(href))).toEqual({ q: "console", sort: "lance" });
    expect(buildStorefrontHref("ana", parseStorefrontView(escrever(href)))).toBe(href);
  });
});
