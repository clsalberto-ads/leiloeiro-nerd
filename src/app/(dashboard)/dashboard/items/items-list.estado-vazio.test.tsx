// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// ponytail: os mocks sao os mesmos que o `items-list.dom.test.tsx` ja faz, e pelo
// mesmo motivo: o `BidCountdown` e cliente (relogio) e as acoes da linha sao
// "use server".
vi.mock("@/components/bid-countdown", () => ({ BidCountdown: () => null }));
vi.mock("@/presentation/actions/item-actions", () => ({
  cancelItemAction: vi.fn(),
  deleteItemAction: vi.fn(),
  publishItemAction: vi.fn(),
}));

import { render, screen } from "@/test/dom-render";
import { ItemsList } from "./items-list";
import { VISTA_PADRAO, type VistaDaTabela } from "./estado-da-tabela";

// ponytail: este arquivo e de DOM (e nao de `renderToString`) por UM motivo: o que
// o teste precisa afirmar e a AFORDANCIA do controle, e `href` nao sobrevive a um
// `<button>` — um botao no HTML e indistinguivel de um botao quebrado, e o
// `onClick` nao aparece no servidor. `getByRole("link")` e a asercao que distingue
// "isto navega" de "isto finge que navega"; o `href` lido do DOM e o que diz para
// ONDE. O resto (as duas frases, a ausencia de acao sem filtro) continua sendo
// leitura de tela, e para isso o DOM e o instrumento certo.
//
// O `navegar` e um espiao sem assertiva: com a saida virando link, o que a lista
// NAO faz e chamar `navegar` para o estado vazio — e o `href` e a prova de que o
// gesto virou navegacao de verdade.
function montar(vista: VistaDaTabela) {
  render(<ItemsList items={[]} vista={vista} totalCount={0} navegar={vi.fn()} />);
}

function limpar() {
  return screen.getByRole("link", { name: "Limpar filtros" });
}

// ponytail: as DUAS situacoes vem da mesma tela, e por isso que elas nao podem
// ser a mesma frase. Com busca, aba, ordenacao e paginacao na URL (Task 9), uma
// tabela vazia e "voce nao tem item nenhum" OU "nada casou com este filtro". A
// primeira nao tem para onde voltar — nao ha filtro para desfazer, e o "+ Novo
// item" do titulo da pagina e o caminho para comecar. A segunda tem, e o caminho
// de volta e a propria coisa que o usuario digitou. Um estado vazio so (o que
// existia antes desta tarefa) dizia "Nenhum item encontrado." para as duas.
describe("ItemsList — os dois estados vazios", () => {
  // ponytail: a string contem "Nenhum item encontrado" porque e o texto que o
  // `items/page.test.tsx` ja fixa no HTML da pagina com `?q=nada`. A frase antiga
  // continuando nele e o que mantem aquele teste de pe sem reescrever nenhum dos
  // 159.
  it("sem filtro, diz que a lista está vazia e não oferece saída", () => {
    montar(VISTA_PADRAO);

    expect(screen.getByText("Você ainda não tem itens.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Limpar filtros" })).toBeNull();
  });

  it("com busca, diz que nada casou e oferece limpar", () => {
    montar({ ...VISTA_PADRAO, q: "nada" });

    expect(screen.getByText("Nenhum item encontrado.")).toBeTruthy();
    expect(screen.queryByText("Você ainda não tem itens.")).toBeNull();
    expect(limpar()).toBeTruthy();
  });

  // ponytail: a aba e o mesmo filtro pelo outro nome — o usuario nao digitou
  // nada, ele clicou. Sem este `it` a aba "Rascunho" vazia cairia no caso de
  // "voce nao tem item nenhum" e nao ofereceria volta nenhuma.
  it("com aba de status, também é nada casou", () => {
    montar({ ...VISTA_PADRAO, status: "draft" });

    expect(screen.getByText("Nenhum item encontrado.")).toBeTruthy();
    expect(limpar()).toBeTruthy();
  });

  // ponytail: o `it` que prova o contrato de verdade. O "voltar" e um LINK com um
  // `href` de verdade, e nao um botao com `onClick`: e o que entrega abrir em nova
  // aba, clique do meio, ctrl-clique, copiar endereco e a URL na barra de status.
  // Um `<button>` nao tem nenhum desses, e a diferenca nao e de estilo — e de
  // controle navegavel. Por isso a asercao e `getByRole("link")` mais o `href`
  // lido do DOM, e nao o texto do rotulo (que um botao mostraria igual).
  it("limpar filtros é uma âncora com href, e não um botão", () => {
    montar({ ...VISTA_PADRAO, q: "nada" });

    expect(limpar().tagName).toBe("A");
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
    expect(limpar().getAttribute("href")).toBe("/dashboard/items");
  });

  // ponytail: o que importa no "voltar" e PARA ONDE ele leva, e esse "onde" e a
  // VISTA sem filtro traduzida pelo `hrefDaVista` (que mora em um lugar so). Um
  // `/dashboard/items` escrito a mao passaria neste `it` — por isso a segunda
  // asercao, com a ordenacao e o tamanho preservados, que e exatamente o caso em
  // que a segunda copia da frase divergiria do `hrefDaVista`.
  it("limpar filtros volta para a lista sem busca, sem aba e na primeira página", () => {
    montar({ ...VISTA_PADRAO, q: "nada", status: "active", page: 3 });

    expect(limpar().getAttribute("href")).toBe("/dashboard/items");
  });

  // ponytail: o filtro tambem muda a PAGINA, e `?page=3&q=nada` e a URL que a
  // pagina corrige por `redirect` quando o filtro encolheu (veja `ultimaPagina`).
  // O "voltar" tem de manter o que o filtro NAO mudou: a ordenacao escolhida e o
  // tamanho da pagina foram cliques do usuario, e um "limpar filtros" que
  // devolvesse a tabela para `createdAt desc` de 10 em 10 apagaria os dois.
  it("limpar filtros mantém a ordenação e o tamanho que o usuário escolheu", () => {
    const ordenada: VistaDaTabela = {
      ...VISTA_PADRAO,
      q: "nada",
      orderBy: "minInitialBid",
      direction: "asc",
      pageSize: 50,
    };
    montar(ordenada);

    expect(limpar().getAttribute("href")).toBe("/dashboard/items?orderBy=minInitialBid&pageSize=50");
  });

  // ponytail: com itens na tela nao ha estado vazio, e nem com a palavra. Este
  // `it` e o que impede a distincao de virar um `if` que so troca a frase e
  // deixa o icone ou a acao para tras em um dos ramos.
  it("com itens na tela, não há estado vazio nenhum", () => {
    render(
      <ItemsList
        items={[
          {
            id: "i1",
            title: "Console retrô",
            type: "product",
            minInitialBid: 10000,
            bidDeadline: new Date("2026-10-01T00:00:00Z"),
            status: "active",
          },
        ]}
        vista={VISTA_PADRAO}
        totalCount={1}
        navegar={vi.fn()}
      />,
    );

    expect(screen.getByText("Console retrô")).toBeTruthy();
    expect(document.querySelector('[data-slot="empty-state"]')).toBeNull();
  });
});
