// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { act, fireEvent, render, screen, within } from "@/test/dom-render";
import { DataTable, type DataTableColumn } from "./data-table";

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

// Desordenadas de proposito: B, C, A. Ascendente comeca em "A" e descendente em
// "C", entao cada estado da ordenacao e distinguivel dos outros dois.
const LINHAS: Linha[] = [
  { id: "1", titulo: "B" },
  { id: "2", titulo: "C" },
  { id: "3", titulo: "A" },
];

const DOZE: Linha[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  titulo: `Item ${String(i + 1).padStart(2, "0")}`,
}));

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

// A propriedade `disabled` do botao nativo e o que realmente trava o clique — um
// `aria-disabled` sozinho deixaria o `onClick` de pe. Os dois sao asseridos.
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

    fireEvent.click(screen.getByRole("combobox", { name: "Linhas por página" }));
    const opcao = screen.getByRole("option", { name: "10" });
    fireEvent.pointerDown(opcao);
    fireEvent.click(opcao);

    expect(onPageSizeChange).toHaveBeenCalledWith(10);
    expect(titulos()).toEqual([
      "Item 01",
      "Item 02",
      "Item 03",
      "Item 04",
      "Item 05",
      "Item 06",
      "Item 07",
      "Item 08",
      "Item 09",
      "Item 10",
    ]);
    expect(screen.getByText("Mostrando 1–10 de 12 itens")).toBeTruthy();
    expect(onPageChange).not.toHaveBeenCalled();
  });
});

describe("DataTable — paginação controlada (manualPagination)", () => {
  const PAGINA_DO_SERVIDOR: Linha[] = [
    { id: "31", titulo: "Item 31" },
    { id: "32", titulo: "Item 32" },
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
});
