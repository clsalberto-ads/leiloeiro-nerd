import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ControlesDaVitrine, ROTULOS_DA_ORDENACAO } from "./controles-da-vitrine";
import { VISTA_PADRAO_DA_VITRINE, LISTA_DE_ORDENACOES } from "./estado-da-vitrine";

const html = (vista = VISTA_PADRAO_DA_VITRINE) =>
  renderToString(<ControlesDaVitrine slug="ana" vista={vista} />);

describe("ControlesDaVitrine — os rotulos derivam da lista, nao sao uma copia", () => {
  it("o ROTULO existe para cada ordenacao da LISTA, e nao so para as tres de hoje", () => {
    // ponytail: este `it` amarra a metade VISUAL do contrato com a metade MAQUINA.
    // `ROTULOS_DA_ORDENACAO` e `Record<OrdenacaoDaVitrine, string>`, entao uma
    // ordenacao nova na LISTA quebraria o `tsc` por falta de linha — e o teste
    // diz a mesma coisa em tempo de execucao, para o dia em que alguem trocar o
    // `Record` por `Partial<Record<...>>` para "nao ser obrigado a escrever o
    // rotulo ainda". O `tsc` parou de corrigir; o teste nao.
    expect(Object.keys(ROTULOS_DA_ORDENACAO).sort()).toEqual([...LISTA_DE_ORDENACOES].sort());
  });

  it("os tres rotulos, na ordem em que aparecem na tela", () => {
    expect(ROTULOS_DA_ORDENACAO).toEqual({
      prazo: "Termina em breve",
      lance: "Maior lance",
      recentes: "Recentes",
    });
  });
});

describe("ControlesDaVitrine — ordenacao", () => {
  it("cada ordenacao e um LINK com o href da vista — nao um botao com callback", () => {
    const saida = html();
    expect(saida).toContain('href="/ana?ordenar=lance"');
    expect(saida).toContain('href="/ana?ordenar=recentes"');
    expect(saida).toContain("Maior lance");
    expect(saida).toContain("Recentes");
  });

  it("a ordenacao atual nao escreve o parametro: ela e o estado inicial", () => {
    // a vista padrao e "prazo", entao o link dela e o caminho puro
    expect(html()).toContain('href="/ana"');
  });

  it("trocar a ordenacao nao perde a busca que ja estava na URL", () => {
    const saida = html({ q: "console", ordenar: "prazo" });
    expect(saida).toContain("q=console");
    expect(saida).toContain("ordenar=lance");
  });

  it("a ordenacao ativa e marcada com aria-current, e SO ela", () => {
    const saida = html({ q: "", ordenar: "lance" });
    expect(saida).toContain('aria-current="true"');
    // ponytail: `aria-current` em mais de um link anuncia "tres vezes o item
    // atual" para o leitor de tela. Contar e o que trava o segundo `aria-current`
    // que alguem adicionaria ao marcar o link ativo.
    expect(saida.match(/aria-current="true"/g)).toHaveLength(1);
  });

  it("a ordem dos botoes e a da LISTA, e a tela concorda com a URL", () => {
    // ponytail: a ordem visual e derivada de `LISTA_DE_ORDENACOES` e nao escrita
    // a mao. O modo de falha que isso evita: uma ordenacao acrescentada na lista
    // aparece no tipo e na validacao e NAO nesta tela — sem erro de tipo e sem
    // teste vermelho. Este `it` e o que impede a lista e a tela de divergirem.
    const posicoes = LISTA_DE_ORDENACOES.map((o) => html().indexOf(ROTULOS_DA_ORDENACAO[o]));
    expect(posicoes.every((p) => p >= 0)).toBe(true);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });
});

describe("ControlesDaVitrine — busca", () => {
  it("a busca e um form GET para o caminho da propria vitrine", () => {
    const saida = html();
    expect(saida).toContain('method="get"');
    expect(saida).toContain('action="/ana"');
  });

  it("a caixa de busca e controlada pela URL: o value vem da vista", () => {
    expect(html({ q: "console", ordenar: "prazo" })).toContain('value="console"');
  });

  it("a caixa tem um label acessivel (sr-only serve, placeholder nao)", () => {
    const saida = html();
    expect(saida).toMatch(/<label[^>]*for="busca-vitrine"|sr-only[^>]*>\s*Buscar/);
  });

  it("o input e nomeado `q`, que e o parametro que o leitor da URL conhece", () => {
    expect(html()).toContain('name="q"');
  });

  it("a ordenacao atual viaja como campo escondido, para a busca nao a perder", () => {
    // ponytail: sem o `hidden`, buscar com "Maior lance" selecionado voltaria para
    // "Termina em breve" — o `hrefDaVista` da pagina manda `q` sozinho quando a
    // ordem e o padrao, entao o form GET so leva o que tem `name`. Este e o
    // mesmo motivo dos botoes de ordenacao preservarem o `q`.
    const saida = html({ q: "", ordenar: "lance" });
    expect(saida).toContain('type="hidden"');
    expect(saida).toContain('name="ordenar"');
    expect(saida).toContain('value="lance"');
  });

  it("nao esconde `ordenar` quando ele ja e o padrao: o campo seria ruido", () => {
    // ponytail: o espelho do caso acima. Mandar `ordenar=prazo` na URL quando o
    // padrao e `prazo` produz uma URL que a leitura reescreve identica — o
    // `hrefDaVista` do round-trip ficaria com duas formas para a mesma tela.
    const saida = html({ q: "", ordenar: "prazo" });
    expect(saida).not.toContain('name="ordenar"');
  });
});
