import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ItemCardSkeleton } from "./skeletons";

// ponytail: 6 e o numero de cards da vitrine que o usuario espera encontrar: duas
// fileiras da grade de tres colunas do `lg` (`sm:grid-cols-2 lg:grid-cols-3`).
// O numero esta escrito AQUI, e nao importado do componente, de proposito: se o
// teste lesse a constante da implementacao, mudar 6 para 3 — ou para 1 — deixaria
// o teste verde com o esqueleto do tamanho errado, que e o defeito que este
// arquivo existe para pegar.
const CARTAS_DO_ESQUELETO = 6;

// ponytail: o esqueleto e ESTATICO por definicao — ele existe para parecer com o
// card enquanto o card nao chegou, entao `renderToString` diz tudo o que ha para
// dizer. Um teste de DOM aqui ia exigir jsdom para afirmar o que o HTML ja prova
// e nao acrescentaria um unico clique, foco ou transicao: nao ha estado.
describe("ItemCardSkeleton", () => {
  const html = () => renderToString(<ItemCardSkeleton />);

  // ponytail: `data-slot` e a convencao que o `ui/skeleton.tsx` ja usa, e e o
  // que torna o esqueleto identificavel no HTML sem depender de texto — que e
  // justo o que um esqueleto nao pode ter. E o que permite contar as barras
  // abaixo, que e a forma.
  it("e identificavel pelo data-slot, sem depender de texto", () => {
    const saida = html();

    expect(saida).toContain('data-slot="item-card-skeleton"');
    expect(saida).toContain('data-slot="skeleton"');
  });

  // ponytail: a forma e a do `PublicItemCard` (imagem + 5 regioes de texto: titulo, lance atual,
  // lance minimo, tipo/contagem e prazo). O numero de barras por card e o que
  // prende essa forma.
  it("desenha seis barras por card: a imagem e as cinco regioes de texto do card novo", () => {
    const saida = html();
    const cards = saida.match(/data-slot="item-card-skeleton"/g) ?? [];

    expect(cards).toHaveLength(CARTAS_DO_ESQUELETO);
    expect(saida.match(/data-slot="skeleton"/g)).toHaveLength(CARTAS_DO_ESQUELETO * 6);
  });

  // ponytail: o que NAO pode aparecer e o conteudo do card. Um esqueleto que
  // vazasse o titulo do item seria pior que nenhum esqueleto: o usuario leria o
  // "Console retro" e depois o card trocaria de posicao quando o item verdadeiro
  // chegasse, e o `<a>` do `PublicItemCard` viraria um link para um item que
  // ainda nao existe.
  it("nao vaza o conteudo do item que ele substitui", () => {
    const saida = html();

    expect(saida).not.toContain("<a");
    expect(saida).not.toContain("Lance mínimo");
    expect(saida).not.toContain("R$");
  });

  // ponytail: o anuncio e do CONTAINER, e nao de cada card. Seis `role="status"`
  // fariam o leitor de tela repetir "carregando" seis vezes; e os blocos de cada
  // card sao decoracao sem informacao, entao levam `aria-hidden` para o leitor nao
  // descer ate eles procurando texto. O rotulo em pt-BR porque e o que o usuario
  // ouvira.
  it("anuncia o carregamento uma vez, no container", () => {
    const saida = html();

    expect(saida).toContain('role="status"');
    expect(saida).toContain('aria-label="Carregando itens"');
    expect(saida.match(/role="status"/g)).toHaveLength(1);
    expect(saida.match(/data-slot="item-card-skeleton"[^>]*aria-hidden="true"/g)).toHaveLength(
      CARTAS_DO_ESQUELETO,
    );
  });
});
