import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { DataTable, type DataTableColumn } from "./data-table";
import type { EmptyStateAction } from "./empty-state";

interface Row {
  id: string;
  titulo: string;
}

const COLUNAS: DataTableColumn<Row>[] = [
  { id: "titulo", header: "Título", accessorFn: (l) => l.titulo, cell: (l) => l.titulo },
];

// ponytail: este arquivo e NOVO de proposito. O `data-table.test.tsx` e o
// `data-table.dom.test.tsx` ja existentes fixam o contrato antigo do estado vazio
// (a `emptyMessage` aparecendo como texto da celula), e um arquivo separado
// deixa esses dois intocados — o estado vazio novo nao precisa reescrever o
// historico de ninguem para ser provado.
//
// ponytail: a celula e recortada do HTML em vez de contar `<svg` no documento
// inteiro, porque a tabela tem outros icones: o botao de ordenacao do cabecalho
// tambem e um `lucide`. Contar no documento todo tornaria a asercao do icone do
// estado vazio dependente de quantas colunas ordenaveis a tabela tem.
//
// ponytail: o `col[Ss]pan` aceita as duas grafias porque elas sao de mundos
// diferentes: o renderizador de servidor escreve `colSpan` como foi escrito no
// JSX, e so o parser do HTML baixa para `colspan` — que e por isso que o
// `data-table.dom.test.tsx` consegue usar `[colspan="2"]` num `querySelector` e
// nao num `renderToString`.
function emptyCell(html: string): string {
  const cell = html.match(/<td[^>]*col[Ss]pan="\d+"[^>]*>[\s\S]*?<\/td>/);
  expect(cell, "célula de estado vazio não encontrada no HTML da tabela").not.toBeNull();
  return cell?.[0] ?? "";
}

function emptyTable(props: { emptyAction?: EmptyStateAction } = {}): string {
  return renderToString(<DataTable columns={COLUNAS} data={[]} emptyMessage="Nada encontrado" {...props} />);
}

describe("DataTable — o estado vazio", () => {
  // ponytail: o `emptyMessage` continua sendo o texto, sem uma palavra a mais. O
  // `data-table.dom.test.tsx` compara o `textContent` da celula com a string
  // EXATA ("Nada encontrado"), e qualquer caractere novo nesse texto — um icone
  // com `title`, um "&nbsp;" — quebraria aquelas asercoes. O icone entra com
  // `aria-hidden` e sem texto, entao some do `textContent` e o contrato antigo
  // continua valendo sem ser reescrito.
  it("mantém a mensagem exata e acrescenta o ícone sem texto", () => {
    const cell = emptyCell(emptyTable());

    expect(cell).toContain("Nada encontrado");
    expect(cell).toContain("<svg");
    expect(cell).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  // ponytail: `data-slot="empty-state"` e a prova de composicao. A celula da
  // tabela NAO tem um cartao proprio com o mesmo formato do `EmptyState` da
  // vitrine: se um dia alguem consertar o visual do estado vazio num lugar e o
  // outro ficar para tras, este teste para de dizer a verdade.
  it("compõe o EmptyState em vez de ter um estado vazio próprio", () => {
    expect(emptyCell(emptyTable())).toContain('data-slot="empty-state"');
  });

  // ponytail: a diferenca entre "voce nao tem item nenhum" e "nada casou com este
  // filtro" mora em quem sabe o que e um filtro — o `DataTable` e generico e nao
  // sabe. Por isso a tabela recebe um `emptyAction` (para ONDE voltar) e nao uma
  // segunda string de texto (QUE TEXTO): o texto continua sendo `emptyMessage`, e
  // o consumidor decide os dois.
  it("oferece a saída quando recebe emptyAction", () => {
    const cell = emptyCell(
      emptyTable({ emptyAction: { label: "Limpar filtros", href: "/dashboard/items" } }),
    );

    expect(cell).toContain("Limpar filtros");
    expect(cell).toContain('href="/dashboard/items"');
  });

  it("não oferece saída quando não recebe emptyAction", () => {
    expect(emptyCell(emptyTable())).not.toContain("<a");
  });

  // ponytail: as duas classes sao a assinatura visual da celula vazia e nenhuma
  // delas aparece no `textContent` que os 38 testes protegidos comparam — e por
  // isso que este `it` existe. `text-muted-foreground` e a cor que a celula tinha
  // antes do `EmptyState` (o titulo do cartao nao declara cor e herda a da
  // celula), e `whitespace-normal` e o que despeta o `whitespace-nowrap` do
  // `TableCell` para uma `description` conseguir enrolar em vez de esticar a
  // tabela. O regex e ancorado no `<td` de proposito: dentro da celula o icone
  // tambem e `text-muted-foreground`, e um `toContain` solto passaria com a
  // classe da celula ausente.
  it("mantém a mensagem apagada e a célula capaz de quebrar linha", () => {
    const cell = emptyCell(emptyTable());

    expect(cell).toMatch(/<td[^>]*\btext-muted-foreground\b/);
    expect(cell).toMatch(/<td[^>]*\bwhitespace-normal\b/);
  });

  // ponytail: a tabela montada em `renderToString` ainda tem cabecalho e rodape.
  // O que interessa e o `colspan` da celula vazia: com o valor errado a tabela fica
  // com um buraco no layout que nenhum aviso accuse, e o rodape continuaria
  // contando linhas que nao existem.
  it("atravessa todas as colunas", () => {
    const cell = emptyCell(emptyTable());
    expect(cell).toContain(`colSpan="${COLUNAS.length}"`);
  });
});
