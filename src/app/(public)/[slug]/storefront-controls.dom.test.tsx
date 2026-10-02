import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { StorefrontControls, SORT_LABELS } from "./storefront-controls";
import { DEFAULT_STOREFRONT_VIEW, STOREFRONT_SORT_OPTIONS } from "./storefront-state";

const html = (view = DEFAULT_STOREFRONT_VIEW) =>
  renderToString(<StorefrontControls slug="ana" view={view} />);

describe("StorefrontControls — os rotulos derivam da lista, nao sao uma copia", () => {
  it("o ROTULO existe para cada ordenacao da LISTA, e nao so para as tres de hoje", () => {
    // ponytail: este `it` amarra a metade VISUAL do contrato com a metade MAQUINA.
    // `SORT_LABELS` e `Record<StorefrontSort, string>`, entao uma
    // ordenacao nova na LISTA quebraria o `tsc` por falta de linha — e o teste
    // diz a mesma coisa em tempo de execucao, para o dia em que alguem trocar o
    // `Record` por `Partial<Record<...>>` para "nao ser obrigado a escrever o
    // rotulo ainda". O `tsc` parou de corrigir; o teste nao.
    expect(Object.keys(SORT_LABELS).sort()).toEqual([...STOREFRONT_SORT_OPTIONS].sort());
  });

  it("os tres rotulos, na ordem em que aparecem na tela", () => {
    expect(SORT_LABELS).toEqual({
      prazo: "Termina em breve",
      lance: "Maior lance",
      recentes: "Recentes",
    });
  });
});

describe("StorefrontControls — ordenacao", () => {
  it("cada ordenacao e um LINK com o href da vista — nao um botao com callback", () => {
    const output = html();
    expect(output).toContain('href="/ana?ordenar=lance"');
    expect(output).toContain('href="/ana?ordenar=recentes"');
    expect(output).toContain("Maior lance");
    expect(output).toContain("Recentes");
  });

  it("a ordenacao atual nao escreve o parametro: ela e o estado inicial", () => {
    // a vista padrao e "prazo", entao o link dela e o caminho puro
    expect(html()).toContain('href="/ana"');
  });

  it("trocar a ordenacao nao perde a busca que ja estava na URL", () => {
    const output = html({ q: "console", sort: "prazo" });
    expect(output).toContain("q=console");
    expect(output).toContain("ordenar=lance");
  });

  it("a ordenacao ativa e marcada com aria-current, e SO ela", () => {
    const output = html({ q: "", sort: "lance" });
    expect(output).toContain('aria-current="true"');
    // ponytail: `aria-current` em mais de um link anuncia "tres vezes o item
    // atual" para o leitor de tela. Contar e o que trava o segundo `aria-current`
    // que alguem adicionaria ao marcar o link ativo.
    expect(output.match(/aria-current="true"/g)).toHaveLength(1);
  });

  it("a ordem dos botoes e a da LISTA, e a tela concorda com a URL", () => {
    // ponytail: a ordem visual e derivada de `STOREFRONT_SORT_OPTIONS` e nao escrita
    // a mao. O modo de falha que isso evita: uma ordenacao acrescentada na lista
    // aparece no tipo e na validacao e NAO nesta tela — sem erro de tipo e sem
    // teste vermelho. Este `it` e o que impede a lista e a tela de divergirem.
    const posicoes = STOREFRONT_SORT_OPTIONS.map((o) => html().indexOf(SORT_LABELS[o]));
    expect(posicoes.every((p) => p >= 0)).toBe(true);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });
});

describe("StorefrontControls — busca", () => {
  it("a busca e um form GET para o caminho da propria vitrine", () => {
    const output = html();
    expect(output).toContain('method="get"');
    expect(output).toContain('action="/ana"');
  });

  it("a caixa de busca e controlada pela URL: o value vem da vista", () => {
    expect(html({ q: "console", sort: "prazo" })).toContain('value="console"');
  });

  it("a caixa tem um label acessivel (sr-only serve, placeholder nao)", () => {
    const output = html();
    expect(output).toMatch(/<label[^>]*for="busca-vitrine"|sr-only[^>]*>\s*Buscar/);
  });

  it("o input e nomeado `q`, que e o parametro que o leitor da URL conhece", () => {
    expect(html()).toContain('name="q"');
  });

  it("a ordenacao atual viaja como campo escondido, para a busca nao a perder", () => {
    // ponytail: sem o `hidden`, buscar com "Maior lance" selecionado voltaria para
    // "Termina em breve" — o `buildStorefrontHref` da pagina manda `q` sozinho quando a
    // ordem e o padrao, entao o form GET so leva o que tem `name`. Este e o
    // mesmo motivo dos botoes de ordenacao preservarem o `q`.
    const output = html({ q: "", sort: "lance" });
    expect(output).toContain('type="hidden"');
    expect(output).toContain('name="ordenar"');
    expect(output).toContain('value="lance"');
  });

  it("nao esconde `ordenar` quando ele ja e o padrao: o campo seria ruido", () => {
    // ponytail: o espelho do caso acima. Mandar `ordenar=prazo` na URL quando o
    // padrao e `prazo` produz uma URL que a leitura reescreve identica — o
    // `buildStorefrontHref` do round-trip ficaria com duas formas para a mesma tela.
    const output = html({ q: "", sort: "prazo" });
    expect(output).not.toContain('name="ordenar"');
  });
});
