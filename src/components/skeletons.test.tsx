import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ItemCardSkeleton } from "./skeletons";

// ponytail: 6 e o numero de cards da vitrine que o usuario espera encontrar: duas
// fileiras da grade de tres colunas do `lg` (`sm:grid-cols-2 lg:grid-cols-3`).
// O numero esta escrito AQUI, e nao importado do componente, de proposito: se o
// teste lesse a constante da implementacao, mudar 6 para 3 — ou para 1 — deixaria
// o teste verde com o esqueleto do tamanho errado, que e o defeito que este
// arquivo existe para pegar.
const SKELETON_CARDS = 6;

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
    const output = html();

    expect(output).toContain('data-slot="item-card-skeleton"');
    expect(output).toContain('data-slot="skeleton"');
  });

  // ponytail: QUATRO barras por card, e a forma do `PublicItemCard` novo: imagem
  // quadrada, titulo, lance atual em destaque e o lance minimo embaixo. A
  // contagem e o que prende o esqueleto ao card — sem ela, um esqueleto de tres
  // barras e um de quatro passariam ambos. Este numero mudou de 3 para 4
  // porque o card mudou, e nao porque o teste cedesse: e a MESMA relacao que o
  // teste sempre affirms, com a forma nova.
  it("desenha quatro barras por card: a imagem, o titulo e os dois valores do lance", () => {
    const output = html();
    const cards = output.match(/data-slot="item-card-skeleton"/g) ?? [];

    expect(cards).toHaveLength(SKELETON_CARDS);
    expect(output.match(/data-slot="skeleton"/g)).toHaveLength(SKELETON_CARDS * 4);
  });

  // ponytail: o que NAO pode aparecer e o conteudo do card. Um esqueleto que
  // vazasse o titulo do item seria pior que nenhum esqueleto: o usuario leria o
  // "Console retro" e depois o card trocaria de posicao quando o item verdadeiro
  // chegasse, e o `<a>` do `PublicItemCard` viraria um link para um item que
  // ainda nao existe.
  it("nao vaza o conteudo do item que ele substitui", () => {
    const output = html();

    expect(output).not.toContain("<a");
    expect(output).not.toContain("Lance mínimo");
    expect(output).not.toContain("R$");
  });

  // ponytail: o anuncio e do CONTAINER, e nao de cada card. Seis `role="status"`
  // fariam o leitor de tela repetir "carregando" seis vezes; e os blocos de cada
  // card sao decoracao sem informacao, entao levam `aria-hidden` para o leitor nao
  // descer ate eles procurando texto. O rotulo em pt-BR porque e o que o usuario
  // ouvira.
  it("anuncia o carregamento uma vez, no container", () => {
    const output = html();

    expect(output).toContain('role="status"');
    expect(output).toContain('aria-label="Carregando itens"');
    expect(output.match(/role="status"/g)).toHaveLength(1);
    expect(output.match(/data-slot="item-card-skeleton"[^>]*aria-hidden="true"/g)).toHaveLength(
      SKELETON_CARDS,
    );
  });
});
