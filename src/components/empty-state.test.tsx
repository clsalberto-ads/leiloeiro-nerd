import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { EmptyState } from "./empty-state";

// ponytail: `renderToString` e o instrumento certo porque o estado vazio e
// ESTATICO — nao ha clique, foco nem estado para exercitar, e o DOM exigiria
// jsdom para provar o que o HTML ja diz. O `link` sai como `<a href>` no servidor
// (mesmo `next/link`), entao o `href` e asserido no HTML e nao por mock.
describe("EmptyState", () => {
  it("mostra titulo, descricao e a acao quando recebe os tres", () => {
    const html = renderToString(
      <EmptyState
        title="Você ainda não tem itens"
        description="Crie o primeiro item para começar a receber lances."
        action={{ label: "Criar item", href: "/dashboard/items/new" }}
      />,
    );

    expect(html).toContain("Você ainda não tem itens");
    expect(html).toContain("Crie o primeiro item para começar a receber lances.");
    expect(html).toContain('href="/dashboard/items/new"');
    expect(html).toContain("Criar item");
  });

  // ponytail: a ausencia da acao e o que separa a vitrine publica (onde o
  // visitante nao tem nada a fazer) da lista do painel (onde ele sempre tem). Um
  // componente que so sabe renderizar o caso com acao obriga o chamador a
  // inventar um link falso; um que so sabe renderizar sem acao obriga a repetir o
  // card inteiro. O `not.toContain("<a")` e a asercao: link de verdade vira `<a>`.
  it("omite a acao quando nao recebe acao", () => {
    const html = renderToString(
      <EmptyState title="Nenhum item em leilão" description="Estefois ainda não leiloou nada." />,
    );

    expect(html).toContain("Nenhum item em leilão");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("href");
  });

  // ponytail: a `description` e OPCIONAL porque o `DataTable` ja tem uma prop de
  // textoso (`emptyMessage`, uma string so, que o contrato da Task 8 consome) e
  // mapear ela em `title` e o que impede a segunda prop de texto. Se a
  // `description` fosse obrigatoria, a tabela teria de inventar uma frase para
  // preencher um campo que o consumidor nao pediu.
  it("omite a descricao quando ela nao vem", () => {
    const com = renderToString(<EmptyState title="Só o título" description="Some isto." />);
    const sem = renderToString(<EmptyState title="Só o título" />);

    expect(com).toContain("Some isto.");
    expect(sem).not.toContain("Some isto.");
    expect(sem).toContain("Só o título");
    // ponytail: o `data-slot` e o que mantem o estado vazio IDENTIFICAVEL no
    // HTML, e e o que permite a `data-table` afirmar que compoe este componente em
    // vez de ter um cartao proprio com o mesmo formato.
    expect(sem).toContain('data-slot="empty-state"');
  });

  // ponytail: o `icon` e um `ReactNode` livre, e nao um `LucideIcon`: quem decide
  // o desenho e o chamador, e o componente so posiciona. O `aria-hidden` do icone
  // fica a cargo de quem o passa (os icones do `lucide` que a casa usa ja vem com
  // ele) — mas um icone sem `aria-hidden` seria lido em voz alta antes do titulo.
  it("renderiza o icone no lugar que o chamador passou", () => {
    const html = renderToString(
      <EmptyState
        title="Nada encontrado"
        icon={<span data-slot="icone-de-teste" />}
        action={{ label: "Limpar filtros", href: "/dashboard/items" }}
      />,
    );

    expect(html).toContain('data-slot="icone-de-teste"');
    expect(html).toMatch(/icone-de-teste[\s\S]*Nada encontrado/);
  });
});
