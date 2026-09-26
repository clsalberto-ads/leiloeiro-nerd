// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { act, fireEvent, render, screen, within } from "@/test/dom-render";
import { DataTable, type DataTableColumn, type DataTableProps } from "./data-table";

interface Linha {
  id: string;
  titulo: string;
}

// ponytail: a coluna "acoes" nao tem `accessorFn` de proposito — e assim que uma
// coluna de acoes (botoes/links, sem valor de acesso) fica fora da ordenacao sem
// precisar de `sortable: false`. O header "Titulo" com `accessorFn` e o que ordena.
const COLUNAS: DataTableColumn<Linha>[] = [
  { id: "titulo", header: "Título", accessorFn: (l) => l.titulo, cell: (l) => l.titulo },
  { id: "acoes", header: "Ações", cell: () => <button type="button">Editar</button> },
];

// ponytail: desordenadas de proposito: B, C, A. Ascendente comeca em "A" e
// descendente em "C", entao cada estado da ordenacao e distinguivel dos outros
// dois.
const LINHAS: Linha[] = [
  { id: "1", titulo: "B" },
  { id: "2", titulo: "C" },
  { id: "3", titulo: "A" },
];

const DOZE: Linha[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  titulo: `Item ${String(i + 1).padStart(2, "0")}`,
}));

// ponytail: 100 linhas porque a 12 o reposicionamento e o clamp dariam a mesma
// pagina (a 3 pagina de 5 vira 2 de 10 nas duas leituras) e o teste nao
// distinguiria as duas. O zero a esquerda ("Item 001") mantem a ordem
// lexicografica igual a numerica: sem ele "Item 10" ordenaria antes de "Item 2".
const CEM: Linha[] = Array.from({ length: 100 }, (_, i) => ({
  id: String(i + 1),
  titulo: `Item ${String(i + 1).padStart(3, "0")}`,
}));

// ponytail: acento em "Ação"/"ção" e o que separa a busca que funciona da que nao
// funciona para quem escreve "acao" num teclado sem cedilha. A coluna de acoes
// segue sem `accessorFn`, entao ela fica fora da busca global.
const COM_ACENTO: Linha[] = [
  { id: "1", titulo: "Ação de megaponte" },
  { id: "2", titulo: "Bicicleta" },
];

function cabecalho(nome: string): HTMLElement {
  return screen.getByRole("columnheader", { name: nome });
}

// ponytail: `getAllByRole("row")` sem escopo devolveria tambem a linha de header
// (o `thead` tambem e `role="row"`), entao o primeiro elemento seria o titulo das
// colunas e nunca um titulo de item. O escopo no `tbody` tira o header fora.
function linhasDoCorpo(): HTMLElement[] {
  const corpo = document.querySelector("tbody");
  expect(corpo, "tabela renderizada sem tbody").not.toBeNull();
  return within(corpo as HTMLElement).getAllByRole("row");
}

function titulos(): string[] {
  return linhasDoCorpo().map((linha) => within(linha).getAllByRole("cell")[0]?.textContent ?? "");
}

// ponytail: a linha de estado vazio tambem e uma `role="row"` do `tbody`, entao ela
// aparece em `titulos()` com o texto da mensagem. Este helper le a celula que
// atravessa as duas colunas (`colspan="2"`) — e `null` enquanto houver linhas.
// O `colspan` tambem e asserido de graca: com `colSpan` errado a tabela fica com
// buraco no layout.
function mensagemDeVazio(): string | null {
  return document.querySelector('tbody [colspan="2"]')?.textContent ?? null;
}

function botao(nome: string): HTMLElement {
  return screen.getByRole("button", { name: nome });
}

// ponytail: a propriedade `disabled` do botao nativo e o que realmente segura o
// `onClick`; um `aria-disabled` sozinho deixaria o handler de pe. E por isso que
// este helper le `disabled` e nao o atributo ARIA — nao existe `aria-disabled`
// neste componente, e um atributo sem efeito seria uma assercao que nunca acusa.
function estaDesabilitado(botaoEl: HTMLElement): boolean {
  return (botaoEl as HTMLButtonElement).disabled === true;
}

async function avancarRelogio(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("DataTable — ordenação pelo header", () => {
  it("alterna ascendente/descendente/sem ordenação e reflete em aria-sort", () => {
    const onSortChange = vi.fn();
    render(<DataTable columns={COLUNAS} data={LINHAS} onSortChange={onSortChange} />);

    expect(cabecalho("Título").getAttribute("aria-sort")).toBe("none");
    expect(titulos()).toEqual(["B", "C", "A"]);

    fireEvent.click(within(cabecalho("Título")).getByRole("button", { name: "Título" }));
    expect(cabecalho("Título").getAttribute("aria-sort")).toBe("ascending");
    expect(titulos()).toEqual(["A", "B", "C"]);
    expect(onSortChange).toHaveBeenLastCalledWith({ id: "titulo", desc: false });

    fireEvent.click(within(cabecalho("Título")).getByRole("button", { name: "Título" }));
    expect(cabecalho("Título").getAttribute("aria-sort")).toBe("descending");
    expect(titulos()).toEqual(["C", "B", "A"]);
    expect(onSortChange).toHaveBeenLastCalledWith({ id: "titulo", desc: true });

    fireEvent.click(within(cabecalho("Título")).getByRole("button", { name: "Título" }));
    expect(cabecalho("Título").getAttribute("aria-sort")).toBe("none");
    expect(titulos()).toEqual(["B", "C", "A"]);
    expect(onSortChange).toHaveBeenLastCalledWith(null);
    expect(onSortChange).toHaveBeenCalledTimes(3);
  });

  it("nao notifica ordenacao antes de o usuario clicar", () => {
    const onSortChange = vi.fn();
    render(<DataTable columns={COLUNAS} data={LINHAS} onSortChange={onSortChange} />);
    expect(onSortChange).not.toHaveBeenCalled();
  });

  it("a coluna de acoes nao tem botao de ordenacao nem aria-sort", () => {
    render(<DataTable columns={COLUNAS} data={LINHAS} />);

    const acoes = cabecalho("Ações");
    expect(acoes.getAttribute("aria-sort")).toBeNull();
    expect(within(acoes).queryByRole("button")).toBeNull();
    expect(titulos()).toEqual(["B", "C", "A"]);
  });

  // ponytail: `sortable: false` e `enableSorting: false` sao o mesmo interruptor
  // com dois nomes no contrato. Este `it.each` e o que impede o componente de
  // honoring so um deles: se o outro nome deixar de desligar a ordenacao, o
  // `aria-sort="none"` volta a aparecer e o header ganha botao.
  it.each([
    ["sortable", { sortable: false } as const],
    ["enableSorting", { enableSorting: false } as const],
  ])("desliga a ordenacao com %s: false mesmo com accessorFn", (_nome, flag) => {
    render(<DataTable columns={[{ ...COLUNAS[0], ...flag }, COLUNAS[1]]} data={LINHAS} />);

    const titulo = cabecalho("Título");
    expect(titulo.getAttribute("aria-sort")).toBeNull();
    expect(within(titulo).queryByRole("button")).toBeNull();
    expect(titulos()).toEqual(["B", "C", "A"]);
  });
});

describe("DataTable — busca com debounce", () => {
  // ponytail: `vi.useFakeTimers()` e nao espera real. O que esta sob teste e
  // "ainda nao disparou aos 299ms" — uma espera de 300ms de verdade passa o teste
  // tambem num componente SEM debounce, porque o CI sempre demora mais que isso.
  // O clock falso e o que torna o limite de 300ms observavel.
  it("nao filtra nem notifica antes de 300ms da ultima tecla", async () => {
    vi.useFakeTimers();
    try {
      const onFilterChange = vi.fn();
      render(<DataTable columns={COLUNAS} data={LINHAS} onFilterChange={onFilterChange} />);
      const busca = screen.getByLabelText("Buscar");

      fireEvent.change(busca, { target: { value: "A" } });
      expect(onFilterChange).not.toHaveBeenCalled();
      expect(titulos()).toEqual(["B", "C", "A"]);
      expect(mensagemDeVazio()).toBeNull();

      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(onFilterChange).not.toHaveBeenCalled();
      expect(titulos()).toEqual(["B", "C", "A"]);
      expect(mensagemDeVazio()).toBeNull();

      await avancarRelogio(1);
      expect(onFilterChange).toHaveBeenCalledTimes(1);
      expect(onFilterChange).toHaveBeenCalledWith("A");
      expect(titulos()).toEqual(["A"]);
      expect(mensagemDeVazio()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("colapsa uma rajada de teclas em uma unica notificacao, com o ultimo valor", async () => {
    vi.useFakeTimers();
    try {
      const onFilterChange = vi.fn();
      render(
        <DataTable columns={COLUNAS} data={LINHAS} onFilterChange={onFilterChange} emptyMessage="Nada encontrado" />,
      );
      const busca = screen.getByLabelText("Buscar");

      fireEvent.change(busca, { target: { value: "A" } });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      fireEvent.change(busca, { target: { value: "AB" } });

      await avancarRelogio(300);
      expect(onFilterChange).toHaveBeenCalledTimes(1);
      expect(onFilterChange).toHaveBeenCalledWith("AB");
      expect(linhasDoCorpo()).toHaveLength(1);
      expect(mensagemDeVazio()).toBe("Nada encontrado");
    } finally {
      vi.useRealTimers();
    }
  });

  it("nao dispara onFilterChange logo ao abrir a tabela", async () => {
    vi.useFakeTimers();
    try {
      const onFilterChange = vi.fn();
      render(<DataTable columns={COLUNAS} data={LINHAS} onFilterChange={onFilterChange} />);

      await avancarRelogio(1000);
      expect(onFilterChange).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a contagem da paginacao conta as linhas filtradas, nao as recebidas", async () => {
    vi.useFakeTimers();
    try {
      render(<DataTable columns={COLUNAS} data={DOZE} pageSize={5} emptyMessage="Nada encontrado" />);

      fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "Item 03" } });
      await avancarRelogio(300);

      expect(titulos()).toEqual(["Item 03"]);
      expect(screen.getByText("Mostrando 1–1 de 1 item")).toBeTruthy();
      expect(estaDesabilitado(botao("Anterior"))).toBe(true);
      expect(estaDesabilitado(botao("Próxima"))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("DataTable — busca sem acento", () => {
  // ponytail: `includesString` do TanStack baixa a caixa mas nao normaliza: e
  // insensivel a CAIXA e sensivel a ACENTO. Num produto pt-BR o usuario digita
  // "acao" e "Ação" desaparece da lista, o que e lido como "nao achou" e nao como
  // "voce esqueceu o acento". O `globalFilterFn` normaliza os dois lados.
  it("acha 'Ação' quando o usuario digita 'acao' sem acento", async () => {
    vi.useFakeTimers();
    try {
      render(<DataTable columns={COLUNAS} data={COM_ACENTO} />);

      fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "acao" } });
      await avancarRelogio(300);

      expect(titulos()).toEqual(["Ação de megaponte"]);
      expect(mensagemDeVazio()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  // ponytail: o outro lado do contrato. Uma normalizacao aplicada so no valor da
  // coluna faria "acao" funcionar e "Ação" sumir — o defeito trocado de lugar.
  it("acha 'Ação' quando o usuario digita 'Ação' com acento", async () => {
    vi.useFakeTimers();
    try {
      render(<DataTable columns={COLUNAS} data={COM_ACENTO} />);

      fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "Ação" } });
      await avancarRelogio(300);

      expect(titulos()).toEqual(["Ação de megaponte"]);
      expect(mensagemDeVazio()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("DataTable — o debounce sobrevive ao pai", () => {
  // ponytail: este teste e a trava do desenho por ref. O efeito do debounce
  // depende SO de `query`; se `onFilterChange` entrasse nas deps, cada arrow nova
  // do pai reiniciaria o timer e a busca so dispararia quando o pai parasse de
  // re-renderizar. O avanco e de 300ms no total mas o ULTIMO re-render acontece
  // aos 250ms, entao o timer nao pode ter sido empurrado: 50ms apos o ultimo
  // re-render ele ja tem de ter disparado.
  it("dispara uma unica vez com o pai re-renderizando e passando arrow nova", async () => {
    vi.useFakeTimers();
    try {
      const onFilterChange = vi.fn();
      // `comPaiNovo()` cria uma arrow nova a cada chamada — e o que um pai que
      // escreve `onFilterChange={(q) => ...}` no JSX produz a cada render.
      const comPaiNovo = () => (
        <DataTable columns={COLUNAS} data={LINHAS} onFilterChange={(q) => onFilterChange(q)} />
      );
      const { rerender } = render(comPaiNovo());
      const busca = screen.getByLabelText("Buscar");

      fireEvent.change(busca, { target: { value: "a" } });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      rerender(comPaiNovo());
      act(() => {
        vi.advanceTimersByTime(100);
      });
      rerender(comPaiNovo());
      act(() => {
        vi.advanceTimersByTime(50);
      });
      rerender(comPaiNovo());

      await avancarRelogio(50);
      expect(onFilterChange).toHaveBeenCalledTimes(1);
      expect(onFilterChange).toHaveBeenCalledWith("a");

      await avancarRelogio(1000);
      expect(onFilterChange).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  // ponytail: o outro lado do mesmo desenho — o ref e lido no instante do timer,
  // e nao capturado no efeito. Com o ref congelado no mount, o timer dispararia
  // contra a callback que ja foi substituida: o pai de hoje nem saberia que
  // filtrou. E por isso que o efeito que atualiza o ref roda SEM array de deps.
  it("chama a callback nova quando o pai troca a identidade no meio do debounce", async () => {
    vi.useFakeTimers();
    try {
      const antes = vi.fn();
      const depois = vi.fn();
      const props = { columns: COLUNAS, data: LINHAS };
      const { rerender } = render(<DataTable {...props} onFilterChange={antes} />);

      fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "Item" } });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      rerender(<DataTable {...props} onFilterChange={depois} />);

      await avancarRelogio(100);
      expect(antes).not.toHaveBeenCalled();
      expect(depois).toHaveBeenCalledTimes(1);
      expect(depois).toHaveBeenCalledWith("Item");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("DataTable — paginação client-side", () => {
  it("avanca, volta e trava os botoes nos limites", () => {
    const onPageChange = vi.fn();
    render(<DataTable columns={COLUNAS} data={DOZE} pageSize={5} onPageChange={onPageChange} />);

    expect(titulos()).toEqual(["Item 01", "Item 02", "Item 03", "Item 04", "Item 05"]);
    expect(screen.getByText("Mostrando 1–5 de 12 itens")).toBeTruthy();
    expect(estaDesabilitado(botao("Anterior"))).toBe(true);
    expect(estaDesabilitado(botao("Próxima"))).toBe(false);

    fireEvent.click(botao("Próxima"));
    expect(titulos()).toEqual(["Item 06", "Item 07", "Item 08", "Item 09", "Item 10"]);
    expect(screen.getByText("Mostrando 6–10 de 12 itens")).toBeTruthy();
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    expect(estaDesabilitado(botao("Anterior"))).toBe(false);

    fireEvent.click(botao("Próxima"));
    expect(titulos()).toEqual(["Item 11", "Item 12"]);
    expect(screen.getByText("Mostrando 11–12 de 12 itens")).toBeTruthy();
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    expect(estaDesabilitado(botao("Próxima"))).toBe(true);

    // ponytail: o clique e disparado MESMO com o botao `disabled`. Num botao
    // nativo o `disabled` e o que segura o handler, entao se a trava sumir do
    // atributo o handler dispara e esta assercao acusa.
    fireEvent.click(botao("Próxima"));
    expect(titulos()).toEqual(["Item 11", "Item 12"]);
    expect(onPageChange).toHaveBeenCalledTimes(2);

    fireEvent.click(botao("Anterior"));
    expect(titulos()).toEqual(["Item 06", "Item 07", "Item 08", "Item 09", "Item 10"]);
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    expect(onPageChange).toHaveBeenCalledTimes(3);
  });

  // ponytail: `pageSize` fora da lista [5,10,20,50] e um caso legitimo (o
  // consumidor escolhe o tamanho). O que nao pode e o tamanho em uso sumir da
  // lista: o usuario veria "3" no gatilho e nao acharia "3" para escolher de novo.
  // (O gatilho em si nunca fica vazio — o `SelectValue` do base-ui cai no valor
  // cru; e por isso que a assercao e sobre a lista de opcoes, e nao sobre ele.)
  it("oferece no Select o tamanho em uso mesmo fora da lista padrao", () => {
    render(<DataTable columns={COLUNAS} data={DOZE} pageSize={3} />);

    expect(linhasDoCorpo()).toHaveLength(3);
    fireEvent.click(screen.getByRole("combobox", { name: "Linhas por página" }));
    expect(screen.getAllByRole("option").map((opcao) => opcao.textContent)).toEqual([
      "3",
      "5",
      "10",
      "20",
      "50",
    ]);
  });

  // ponytail: comeca na pagina 2 (0-based) porque e a unica pagina em que "keeps
  // the current page" e "resets to page 0" sao respostas diferentes. Na pagina 0
  // as duas produzem a mesma tela, entao o teste passaria com o codigo quebrado.
  it("muda o tamanho de pagina pelo Select e mantem a pagina atual", () => {
    const onPageSizeChange = vi.fn();
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={COLUNAS}
        data={DOZE}
        pageSize={5}
        onPageSizeChange={onPageSizeChange}
        onPageChange={onPageChange}
      />,
    );

    fireEvent.click(botao("Próxima"));
    fireEvent.click(botao("Próxima"));
    expect(titulos()).toEqual(["Item 11", "Item 12"]);

    fireEvent.click(screen.getByRole("combobox", { name: "Linhas por página" }));
    const opcao = screen.getByRole("option", { name: "10" });
    fireEvent.pointerDown(opcao);
    fireEvent.click(opcao);

    expect(onPageSizeChange).toHaveBeenCalledWith(10);
    // ponytail: a janela visivel e preservada em vez de voltar a primeira: a
    // primeira linha da pagina 2 era "Item 11" (indice 10) e e ela que abre a
    // nova pagina de 10. E o que o `setPageSize` do TanStack faz, e o que o pai
    // precisa ver para o prop `pageSize` nao virar letra morta.
    expect(titulos()).toEqual(["Item 11", "Item 12"]);
    expect(screen.getByText("Mostrando 11–12 de 12 itens")).toBeTruthy();
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  // ponytail: o efeito que espelha a prop `pageSize` precisa mexer no `pageIndex`
  // junto. Sem isso a prop nova chega com o indice antigo e a tabela fatia um
  // intervalo que nao existe: `pageIndex=2` com `pageSize=10` sobre 12 linhas e
  // `slice(20, 30)`, vazio, com o rodape anunciando "21–12 de 12".
  it("acompanha a prop pageSize sem deixar a pagina fora do intervalo", () => {
    const props = { columns: COLUNAS, data: DOZE };
    const { rerender } = render(<DataTable {...props} pageSize={5} />);

    fireEvent.click(botao("Próxima"));
    fireEvent.click(botao("Próxima"));
    expect(titulos()).toEqual(["Item 11", "Item 12"]);

    rerender(<DataTable {...props} pageSize={10} />);

    expect(mensagemDeVazio()).toBeNull();
    expect(titulos()).toEqual(["Item 11", "Item 12"]);
    expect(screen.getByText("Mostrando 11–12 de 12 itens")).toBeTruthy();
  });

  // ponytail: isto fixa a ESCOLHA entre "reposicionar" e "limitar". Nas 12 linhas
  // do teste acima os dois dao a mesma pagina; aqui nao. Com 100 linhas, pagina 9
  // de 5 (indice 45 = "Item 046"), o limite mandaria para a pagina 9 de 10
  // ("Item 091") e o usuario perderia 45 itens de vista. O reposicionamento
  // preserva a primeira linha visivel — a mesma aritmetica do `setPageSize`.
  it("preserva a primeira linha visivel quando a prop pageSize muda", () => {
    const props = { columns: COLUNAS, data: CEM };
    const { rerender } = render(<DataTable {...props} pageSize={5} />);

    for (let pagina = 0; pagina < 9; pagina += 1) fireEvent.click(botao("Próxima"));
    expect(titulos()[0]).toBe("Item 046");

    rerender(<DataTable {...props} pageSize={10} />);

    expect(titulos()[0]).toBe("Item 041");
    expect(screen.getByText("Mostrando 41–50 de 100 itens")).toBeTruthy();
  });
});

describe("DataTable — paginação controlada (manualPagination)", () => {
  const PAGINA_DO_SERVIDOR: Linha[] = [
    { id: "31", titulo: "Item 31" },
    { id: "32", titulo: "Item 32" },
  ];

  // ponytail: "C", "A" e nao "A", "C" de proposito. A pagina do servidor ja veio
  // numa ordem, e o que o componente nao pode fazer e reordena-la sozinho: no
  // modo servidor quem ordena e o servidor, e reordenar aqui mostraria um
  // fragmento ordenado que nao corresponde a nenhum conjunto de dados.
  const PAGINA_DESORDENADA: Linha[] = [
    { id: "1", titulo: "C" },
    { id: "2", titulo: "A" },
  ];

  it("renderiza a pagina que o pai mandou, sem fatiá-la de novo", () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={COLUNAS}
        data={PAGINA_DO_SERVIDOR}
        manualPagination
        pageIndex={1}
        pageSize={2}
        totalCount={10}
        sort={null}
        filter=""
        onPageChange={onPageChange}
      />,
    );

    expect(titulos()).toEqual(["Item 31", "Item 32"]);
    expect(screen.getByText("Mostrando 3–4 de 10 itens")).toBeTruthy();
    expect(estaDesabilitado(botao("Anterior"))).toBe(false);
    expect(estaDesabilitado(botao("Próxima"))).toBe(false);
  });

  it("so notifica a troca de pagina: quem decide a pagina renderizada e o pai", () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={COLUNAS}
        data={PAGINA_DO_SERVIDOR}
        manualPagination
        pageIndex={1}
        pageSize={2}
        totalCount={10}
        sort={null}
        filter=""
        onPageChange={onPageChange}
      />,
    );

    fireEvent.click(botao("Próxima"));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    expect(titulos()).toEqual(["Item 31", "Item 32"]);

    fireEvent.click(botao("Anterior"));
    expect(onPageChange).toHaveBeenLastCalledWith(0);
    expect(onPageChange).toHaveBeenCalledTimes(2);
    expect(titulos()).toEqual(["Item 31", "Item 32"]);
  });

  it("tranca 'Anterior' na primeira pagina do servidor", () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={COLUNAS}
        data={PAGINA_DO_SERVIDOR}
        manualPagination
        pageIndex={0}
        pageSize={2}
        totalCount={10}
        sort={null}
        filter=""
        onPageChange={onPageChange}
      />,
    );

    expect(estaDesabilitado(botao("Anterior"))).toBe(true);
    expect(estaDesabilitado(botao("Próxima"))).toBe(false);
    expect(screen.getByText("Mostrando 1–2 de 10 itens")).toBeTruthy();
  });

  it("ordenar e buscar voltam para a pagina 0 do servidor", () => {
    const onPageChange = vi.fn();
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={COLUNAS}
        data={PAGINA_DO_SERVIDOR}
        manualPagination
        pageIndex={2}
        pageSize={2}
        totalCount={10}
        sort={null}
        filter=""
        onPageChange={onPageChange}
        onSortChange={onSortChange}
      />,
    );

    fireEvent.click(within(cabecalho("Título")).getByRole("button", { name: "Título" }));
    expect(onSortChange).toHaveBeenLastCalledWith({ id: "titulo", desc: false });
    expect(onPageChange).toHaveBeenLastCalledWith(0);
  });

  it("buscar volta para a pagina 0 do servidor depois do debounce", async () => {
    vi.useFakeTimers();
    try {
      const onPageChange = vi.fn();
      const onFilterChange = vi.fn();
      render(
        <DataTable
          columns={COLUNAS}
          data={PAGINA_DO_SERVIDOR}
          manualPagination
          pageIndex={2}
          pageSize={2}
          totalCount={10}
          sort={null}
          filter=""
          onPageChange={onPageChange}
          onFilterChange={onFilterChange}
        />,
      );

      fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "Item" } });
      expect(onPageChange).not.toHaveBeenCalled();

      await avancarRelogio(300);
      expect(onFilterChange).toHaveBeenCalledWith("Item");
      expect(onPageChange).toHaveBeenLastCalledWith(0);
    } finally {
      vi.useRealTimers();
    }
  });

  // ponytail: o teste que separa os dois modos. "Item 01" existe no conjunto todo
  // mas NAO na pagina que o servidor mandou, entao um filtro client-side esvaziaria
  // a tabela — e o rodape continuaria anunciando 10 itens, porque `getRowCount()`
  // devolve o `rowCount` (o `totalCount` do pai) sem olhar o filtro. No modo
  // servidor a tabela nao filtra nada: ela mostra a pagina que chegou e avisa o
  // pai pelo `onFilterChange`.
  it("nao refata a pagina do servidor com o termo que o pai vai filtrar", async () => {
    vi.useFakeTimers();
    try {
      const onFilterChange = vi.fn();
      render(
        <DataTable
          columns={COLUNAS}
          data={PAGINA_DO_SERVIDOR}
          manualPagination
          pageIndex={0}
          pageSize={2}
          totalCount={10}
          sort={null}
          filter=""
          onFilterChange={onFilterChange}
        />,
      );

      fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "Item 01" } });
      await avancarRelogio(300);

      expect(onFilterChange).toHaveBeenCalledWith("Item 01");
      expect(titulos()).toEqual(["Item 31", "Item 32"]);
      expect(mensagemDeVazio()).toBeNull();
      expect(screen.getByText("Mostrando 1–2 de 10 itens")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("nao reordena a pagina do servidor antes de o servidor responder", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={COLUNAS}
        data={PAGINA_DESORDENADA}
        manualPagination
        pageSize={2}
        totalCount={2}
        sort={null}
        filter=""
        onSortChange={onSortChange}
      />,
    );

    fireEvent.click(within(cabecalho("Título")).getByRole("button", { name: "Título" }));

    expect(onSortChange).toHaveBeenLastCalledWith({ id: "titulo", desc: false });
    expect(titulos()).toEqual(["C", "A"]);
    // ponytail: o `aria-sort` reflecte a ordenacao PEDIDA, que o servidor ainda
    // vai atender. E o sinal de que o clique pegou — sem ele o usuario clica no
    // header e nao ve nenhuma confirmacao ate a resposta chegar. A lista embaixo
    // continua sendo a do servidor, que e o que o outro lado desta trava protege.
    expect(cabecalho("Título").getAttribute("aria-sort")).toBe("ascending");
  });
});

// ponytail: a coluna de dinheiro existe aqui e nao na lista de itens porque a
// lista e so servidor (e la o `accessorFn` nao ordena nada: quem ordena e o SQL).
// O componente generico ainda tem o ramo cliente, e e nele que o `accessorFn` e
// ao mesmo tempo o valor que ordena e o que a busca casa — e o par
// "1.234,56" / "1.000,00" / "50,00" e o dado que quebra o cancelamento de erros:
// como texto, "1.000,00" < "1.234,56" < "50,00" e a lista comeca em "Mil".
interface LinhaComValor extends Linha {
  valor: number;
}

const COLUNAS_COM_VALOR: DataTableColumn<LinhaComValor>[] = [
  { id: "titulo", header: "Título", accessorFn: (l) => l.titulo, cell: (l) => l.titulo },
  { id: "valor", header: "Valor", accessorFn: (l) => l.valor, cell: (l) => `R$ ${l.valor}` },
];

const DINHEIRO: LinhaComValor[] = [
  { id: "1", titulo: "Mil", valor: 100000 },
  { id: "2", titulo: "Duzentos", valor: 123456 },
  { id: "3", titulo: "Cinquenta", valor: 5000 },
];

describe("DataTable — ordenação e busca controladas pelo pai", () => {
  // ponytail: `sort`/`filter` sao props novas e a prova de que elas ESPELHAM o
  // pai vem do `aria-sort`: a seta do cabecalho e o unico lugar da tela onde o
  // usuario ve a ordenacao, entao se ela nao acompanhar a prop, a URL e a tela
  // discordam em silencio.
  it("mostra a ordenacao que o pai mandou, sem esperar clique", () => {
    render(
      <DataTable
        columns={COLUNAS}
        data={LINHAS}
        manualPagination
        totalCount={10}
        sort={{ id: "titulo", desc: true }}
        filter=""
      />,
    );

    expect(cabecalho("Título").getAttribute("aria-sort")).toBe("descending");
  });

  it("troca a seta quando o pai devolve outra ordenacao", () => {
    const props = {
      columns: COLUNAS,
      data: LINHAS,
      manualPagination: true,
      totalCount: 10,
      filter: "",
    } as const;
    const { rerender } = render(<DataTable {...props} sort={{ id: "titulo", desc: true }} />);
    expect(cabecalho("Título").getAttribute("aria-sort")).toBe("descending");

    rerender(<DataTable {...props} sort={{ id: "titulo", desc: false }} />);
    expect(cabecalho("Título").getAttribute("aria-sort")).toBe("ascending");

    rerender(<DataTable {...props} sort={null} />);
    expect(cabecalho("Título").getAttribute("aria-sort")).toBe("none");
  });

  // ponytail: o espelho e por VALOR, e este e o teste que paga a conta disso. O
  // pai re-renderiza depois do clique com a MESMA prop que ja mandava (a resposta
  // do servidor ainda nao chegou) e o espelho nao pode sobrescrever a intencao do
  // click — se sobrescrevesse, a seta piscaria de volta e o clique pareceria
  // ignorado. Comparar por identidade (`!==`) quebraria este teste com um laco de
  // re-render, porque o pai cria `{ id, desc }` novo a cada render.
  it("preserva o clique pendente enquanto o pai nao devolve outra ordenacao", () => {
    const props = {
      columns: COLUNAS,
      data: LINHAS,
      manualPagination: true,
      totalCount: 10,
      filter: "",
    } as const;
    const { rerender } = render(<DataTable {...props} sort={null} />);

    fireEvent.click(within(cabecalho("Título")).getByRole("button", { name: "Título" }));
    expect(cabecalho("Título").getAttribute("aria-sort")).toBe("ascending");

    rerender(<DataTable {...props} sort={null} />);
    expect(cabecalho("Título").getAttribute("aria-sort")).toBe("ascending");
  });

  // ponytail: o caso ao LADO do anterior, e o unico em que "comparar por valor" e
  // "comparar por identidade" discordam. Aqui a prop nao e `null`: e uma ordenacao
  // de verdade, e o pai re-renderiza com um objeto NOVO de mesmo valor (o
  // espelho por valor ignora; o por identidade repassaria `sorting` para tras e
  // apagaria o clique que o usuario acabou de fazer). A diferenca so aparece com
  // `sort` preenchido porque `null === null` e verdadeiro nos dois criterios — e
  // por isso que o teste anterior, so com `null`, nao pega essa regressao. Vale a
  // pena ter os dois: o `null` cobre a primeira visita, este cobre a navegacao de
  // volta, que e onde o pai tem prop de verdade.
  it("preserva o clique pendente quando o pai devolve a mesma ordenacao em outro objeto", () => {
    const props = {
      columns: COLUNAS,
      data: LINHAS,
      manualPagination: true,
      totalCount: 10,
      filter: "",
    } as const;
    const { rerender } = render(<DataTable {...props} sort={{ id: "titulo", desc: true }} />);
    expect(cabecalho("Título").getAttribute("aria-sort")).toBe("descending");

    // ponytail: o ciclo de tres estados faz este clique cair em "sem ordenacao", e
    // nao em "ascendente" — clicar numa coluna ja descendente avanca no ciclo, e
    // o proximo estado e o vazio. Serve ainda melhor ao teste: e o clique cujo
    // resultado o espelho por valor tem difficulty de apagar, porque o espelho por
    // identidade devolveria a seta para baixo e fingiria que o clique nao aconteceu.
    fireEvent.click(within(cabecalho("Título")).getByRole("button", { name: "Título" }));
    expect(cabecalho("Título").getAttribute("aria-sort")).toBe("none");

    // ponytail: objeto novo, mesmo valor. E o que um pai sem `useMemo` entrega.
    rerender(<DataTable {...props} sort={{ id: "titulo", desc: true }} />);
    expect(cabecalho("Título").getAttribute("aria-sort")).toBe("none");
  });

  it("abre a caixa de busca ja com o termo do pai", () => {
    render(
      <DataTable
        columns={COLUNAS}
        data={LINHAS}
        manualPagination
        totalCount={10}
        sort={null}
        filter="Item 02"
      />,
    );

    expect((screen.getByLabelText("Buscar") as HTMLInputElement).value).toBe("Item 02");
  });

  it("acompanha o termo novo que chega do pai", () => {
    const props = { columns: COLUNAS, data: LINHAS, manualPagination: true, totalCount: 10, sort: null } as const;
    const { rerender } = render(<DataTable {...props} filter="Item 02" />);
    expect((screen.getByLabelText("Buscar") as HTMLInputElement).value).toBe("Item 02");

    rerender(<DataTable {...props} filter="Item 03" />);
    expect((screen.getByLabelText("Buscar") as HTMLInputElement).value).toBe("Item 03");
  });

  // ponytail: os dois testes juntos fecham o laco do historico do navegador. O
  // termo que CHEGA do pai nao pode ser re-notificado ao pai: um back/forward
  // escrevendo de volta o valor que acabou de ler da URL seria um eco, e com
  // `router.push` viraria navegacao em loop.
  it("nao devolve para o pai o termo que veio dele", async () => {
    vi.useFakeTimers();
    try {
      const onFilterChange = vi.fn();
      const props = {
        columns: COLUNAS,
        data: LINHAS,
        manualPagination: true,
        totalCount: 10,
        sort: null,
        onFilterChange,
      } as const;
      const { rerender } = render(<DataTable {...props} filter="Item 02" />);
      await avancarRelogio(300);
      expect(onFilterChange).not.toHaveBeenCalled();

      rerender(<DataTable {...props} filter="Item 03" />);
      await avancarRelogio(300);
      expect(onFilterChange).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("nao dispara a busca ao abrir a tabela com o filtro do pai", async () => {
    vi.useFakeTimers();
    try {
      const onFilterChange = vi.fn();
      render(
        <DataTable
          columns={COLUNAS}
          data={LINHAS}
          manualPagination
          totalCount={10}
          sort={null}
          filter="Item"
          onFilterChange={onFilterChange}
        />,
      );

      await avancarRelogio(300);
      expect(onFilterChange).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  // ponytail: a coluna de dinheiro, com os dois lados do `accessorFn` no mesmo
  // lugar — ordena por numero e busca pelo numero. Se o `accessorFn` devolvesse o
  // texto "R$ 100.000,00", a coluna continuaria ordenando (o `sortingFn` padrao
  // compara strings) mas em ordem alfabetica — "R$ 100.000,00" antes de
  // "R$ 123.456,00" antes de "R$ 5.000,00", que e uma ordem que o usuario le
  // como errada. E o primeiro clique desce (`getAutoSortDir` do TanStack desce
  // para numero e sobe para texto), entao as duas direcoes aparecem.
  it("ordena a coluna de dinheiro por numero, e nao pelo texto formatado", () => {
    render(<DataTable columns={COLUNAS_COM_VALOR} data={DINHEIRO} />);
    const colunaValor = () =>
      linhasDoCorpo().map((linha) => within(linha).getAllByRole("cell")[0]?.textContent ?? "");

    fireEvent.click(within(cabecalho("Valor")).getByRole("button", { name: "Valor" }));
    expect(colunaValor()).toEqual(["Duzentos", "Mil", "Cinquenta"]);

    fireEvent.click(within(cabecalho("Valor")).getByRole("button", { name: "Valor" }));
    expect(colunaValor()).toEqual(["Cinquenta", "Mil", "Duzentos"]);
  });
});

describe("DataTable — o contrato de props", () => {
  // ponytail: o que esta sob teste aqui e o COMPILADOR, nao o runtime — por isso
  // que a assercao e trivial e o vermelho vem do `tsc --noEmit` (e nao do
  // `vitest`, que nao checa tipos). O `@ts-expect-error` acima da declaracao
  // some sozinho se a union perder o vinculo `manualPagination` -> `totalCount`:
  // o compilador deixa de reclamar, o comentario vira "unused" e o `tsc` falha.
  it("proibe manualPagination sem totalCount", () => {
    // @ts-expect-error `manualPagination` sem `totalCount` renderiza uma tabela morta
    const propsMortas: DataTableProps<Linha> = {
      columns: COLUNAS,
      data: LINHAS,
      manualPagination: true,
      sort: null,
      filter: "",
    };

    expect(propsMortas.manualPagination).toBe(true);
  });

  // ponytail: `sort` e `filter` no ramo servidor nao sao exigencia estetica. Sem
  // `filter`, a busca continua no `onFilterChange` e o filtro APLICADO volta para
  // "" depois do debounce, apagando o termo do usuario; sem `sort`, a seta
  // announce um cabecalho que o pai nao pediu. Os dois sao o tipo de defeito que
  // so aparece com o servidor de volta, entao o esquecimento tem de ser erro de
  // compilacao.
  it("proibe manualPagination sem sort e sem filter", () => {
    // @ts-expect-error no modo servidor, `sort` e `filter` fazem parte do contrato
    const propsSemOrdenacao: DataTableProps<Linha> = {
      columns: COLUNAS,
      data: LINHAS,
      manualPagination: true,
      totalCount: 10,
    };

    expect(propsSemOrdenacao.manualPagination).toBe(true);
  });
});
