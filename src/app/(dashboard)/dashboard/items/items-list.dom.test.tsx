// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "@/domain/repositories/item-repository";

// ponytail: a action real (drizzle/pg/better-auth) arrastaria o banco para
// dentro do grafo de import — o mesmo motivo do `vi.mock` em
// `items-list.test.tsx`. Os mocks vivem no `vi.hoisted` porque a assercao
// acontece no arquivo de teste e nao no modulo: o `vi.mock` troca o simbolo
// importado, o `vi.fn()` solto na factory nao seria legivel daqui.
const mocks = vi.hoisted(() => ({
  cancelar: vi.fn(),
  excluir: vi.fn(),
  publicar: vi.fn(),
}));

vi.mock("@/presentation/actions/item-actions", () => ({
  cancelItemAction: mocks.cancelar,
  deleteItemAction: mocks.excluir,
  publishItemAction: mocks.publicar,
}));

// ponytail: o `BidCountdown` e um relogio (`setInterval` + `Date.now`) e o unico
// lugar onde a data limite vira "5 d 12 h 0 min 0 s". Deixalo real aqui trocaria
// o texto asserido da celula de prazo por uma contagem viva; o contrato dele
// (receber o `bidDeadline` do item ativo) ja e guardado pelo
// `items-list.test.tsx`, que roda o componente de verdade.
vi.mock("@/components/bid-countdown", () => ({ BidCountdown: () => null }));

import { act, fireEvent, render, screen, within } from "@/test/dom-render";
import { ItemsList } from "./items-list";

// ponytail: meio-dia UTC. O texto da data eformatado no fuso do processo, e
// 12:00 UTC e a hora que cai no mesmo dia civil em qualquer fuso de -12 a +11
// (os tres que sobram, +12 a +14, sao ilhas desabitadas). Com 00:00 UTC o
// "01/10" viraria "30/09" em Fortaleza e o teste passaria so nesta maquina.
const PRAZO = new Date("2026-10-01T12:00:00Z");

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "i1",
    sellerId: "u1",
    title: "Console retrô",
    description: "Console retrô completo com caixa.",
    type: "product",
    imageUrl: null,
    minInitialBid: 10000,
    minBidIncrement: 500,
    bidDeadline: PRAZO,
    paymentDeadlineDays: 3,
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

const CONSOLE = makeItem({ id: "i-console", minInitialBid: 123456 });
const BICICLETA = makeItem({ id: "i-bicicleta", title: "Bicicleta", type: "piece", minInitialBid: 5000, status: "draft" });
const SERVICO = makeItem({ id: "i-servico", title: "Serviço de reparo", type: "service", minInitialBid: 100000, status: "closed" });
const CANCELADO = makeItem({ id: "i-cancelado", title: "Monitor quebrado", status: "cancelled" });
const DESORDENADOS = [CONSOLE, BICICLETA, SERVICO];

// ponytail: `getAllByRole("row")` sem escopo devolveria tambem a linha do
// cabecalho (o `thead` tambem e `role="row"`), entao a primeira linha seria o
// titulo das colunas e nunca o titulo de um item.
function corpo(): HTMLElement {
  const elemento = document.querySelector("tbody");
  expect(elemento, "tabela renderizada sem tbody").not.toBeNull();
  return elemento as HTMLElement;
}

function linhas(): HTMLElement[] {
  return within(corpo()).getAllByRole("row");
}

function celulas(linha: HTMLElement): string[] {
  return within(linha).getAllByRole("cell").map((celula) => celula.textContent ?? "");
}

function titulos(): string[] {
  return linhas().map((linha) => celulas(linha)[0] ?? "");
}

function unicaLinha(): HTMLElement {
  const todas = linhas();
  expect(todas, "tabela sem linha de item").toHaveLength(1);
  return todas[0];
}

function cabecalho(nome: string): HTMLElement {
  return screen.getByRole("columnheader", { name: nome });
}

function botaoDeOrdenacao(nome: string): HTMLElement {
  return within(cabecalho(nome)).getByRole("button", { name: nome });
}

function acoesDe(titulo: string): HTMLElement {
  return screen.getByRole("button", { name: `Ações de ${titulo}` });
}

// ponytail: os mocks das actions vivem no modulo do arquivo, entao as chamadas
// de um teste sobrariam no seguinte e o `not.toHaveBeenCalled()` de "so para ela"
// viraria uma asercao sobre o teste anterior — sempre verdadeira, nunca uma
// falha real.
beforeEach(() => {
  vi.clearAllMocks();
});

async function avancarRelogio(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("ItemsList — as colunas da tabela", () => {
  // ponytail: a lista exata de cabecalhos, e nao "um cabecalho por vez": e o que
  // acusa a coluna que some (a ordem das outras se desloca) e a coluna nova que
  // aparece. A ordem e uma decisao de produto — o olho le da esquerda para a
  // direita, o titulo abre a linha — entao mudar e um ato consciente.
  it("mostra exatamente as seis colunas acordadas, na ordem", () => {
    render(<ItemsList items={[CONSOLE]} current="all" />);

    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Título",
      "Tipo",
      "Status",
      "Lance mínimo",
      "Deadline",
      "Ações",
    ]);
  });

  it("preenche a linha com o titulo, o tipo, o status, o lance e o prazo do item", () => {
    render(<ItemsList items={[CONSOLE]} current="all" />);

    // ponytail: a celula de acoes entra como string vazia — o gatilho dela e um
    // botao so com icone, e o nome dele e o `aria-label`, nao texto. A string
    // vazia e o que prova que a celula existe mesmo sem texto legivel.
    expect(celulas(unicaLinha())).toEqual([
      "Console retrô",
      "Produto",
      "Em leilão",
      "R$ 1.234,56",
      "01/10/2026",
      "",
    ]);
  });

  it("traduz o tipo do item para pt-BR", () => {
    render(<ItemsList items={DESORDENADOS} current="all" />);

    expect(linhas().map(celulas).map((c) => c[1])).toEqual([
      "Produto",
      "Peça colecionável",
      "Serviço",
    ]);
  });

  it("usa o ItemStatusBadge na celula de status, nao um texto solto", () => {
    render(<ItemsList items={DESORDENADOS} current="all" />);

    // ponytail: `data-slot="badge"` e o que separa o `Badge` do shadcn de um
    // `<span>` montado a mao — o rotulo ("Em leilao") sozinho passaria nos dois.
    for (const rotulo of ["Em leilão", "Rascunho", "Encerrado"]) {
      expect(within(corpo()).getByText(rotulo).getAttribute("data-slot")).toBe("badge");
    }
  });

  it("formata o lance minimo em reais, e nao em centavos crus", () => {
    render(<ItemsList items={[CONSOLE]} current="all" />);

    // 123456 centavos. O ponto e a virgula so saem do `formatReais`: o numero
    // cru renderizaria "123456". A busca e por texto, e nao por indice de
    // celula, para a falha dizer o que sumiu em vez de acusar a coluna vizinha.
    expect(within(unicaLinha()).getByText("R$ 1.234,56")).toBeTruthy();
  });

  it("formata o prazo em data pt-BR dentro de um elemento time", () => {
    render(<ItemsList items={[CONSOLE]} current="all" />);

    const tempo = within(unicaLinha()).getByText("01/10/2026");
    expect(tempo.tagName).toBe("TIME");
    // ponytail: o `datetime` e o instante em UTC, independente do fuso — e ele
    // que acusa um `toISOString` trocado pelo texto ja formatado, caso em que o
    // "01/10/2026" continuaria igual e o teste passaria.
    expect(tempo.getAttribute("datetime")).toBe("2026-10-01T12:00:00.000Z");
  });

  it("liga o titulo da coluna ao editor daquele item", () => {
    render(<ItemsList items={[CONSOLE, BICICLETA]} current="all" />);

    const link = within(linhas()[0]).getByRole("link", { name: "Console retrô" });
    expect(link.getAttribute("href")).toBe("/dashboard/items/i-console/edit");
  });
});

describe("ItemsList — as colunas que ordenam", () => {
  // ponytail: `accessorFn` ausente e o que tira uma coluna da ordenacao no
  // `DataTable` (ele nao tem valor de acesso, e a coluna de acoes tem botao e
  // link). O criterio do teste e o mesmo sinal que o usuario ve: `aria-sort` no
  // cabecalho, que so existe em coluna ordenavel.
  it("ordena as cinco colunas de dado e deixa Ações fora", () => {
    render(<ItemsList items={DESORDENADOS} current="all" />);

    const ordenaveis = screen
      .getAllByRole("columnheader")
      .filter((th) => th.getAttribute("aria-sort") !== null);
    expect(ordenaveis.map((th) => th.textContent)).toEqual([
      "Título",
      "Tipo",
      "Status",
      "Lance mínimo",
      "Deadline",
    ]);
    expect(cabecalho("Ações").getAttribute("aria-sort")).toBeNull();
    expect(within(cabecalho("Ações")).queryByRole("button")).toBeNull();
  });

  // ponytail: ordenar por "1.234,56", "1.000,00" e "50,00" como texto daria
  // 1.000,00 < 1.234,56 < 50,00 — a lista comecaria em "Servico" e nao em
  // "Bicicleta". E por isso que o valor do lance e o numero em centavos e nao o
  // texto formatado: as duas ordens abaixo sao diferentes e so uma delas e a de
  // dinheiro. A primeira direcao e descendente porque o `getAutoSortDir` do
  // TanStack sobe primeiro quando o valor de acesso nao e string — numero grande
  // em primeiro. O dado nao ordena como texto, e o que este teste mede.
  it("ordena por lance minimo em ordem de dinheiro, nao de texto", () => {
    render(<ItemsList items={DESORDENADOS} current="all" />);
    expect(titulos()).toEqual(["Console retrô", "Bicicleta", "Serviço de reparo"]);

    fireEvent.click(botaoDeOrdenacao("Lance mínimo"));
    expect(titulos()).toEqual(["Console retrô", "Serviço de reparo", "Bicicleta"]);

    fireEvent.click(botaoDeOrdenacao("Lance mínimo"));
    expect(titulos()).toEqual(["Bicicleta", "Serviço de reparo", "Console retrô"]);
  });
});

describe("ItemsList — as acoes por status", () => {
  it("oferece Publicar e Excluir num rascunho", async () => {
    render(<ItemsList items={[BICICLETA]} current="all" />);

    fireEvent.click(acoesDe("Bicicleta"));

    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
      "Publicar",
      "Excluir",
    ]);
  });

  it("oferece Cancelar num item em leilao e num encerrado", async () => {
    render(<ItemsList items={[CONSOLE, SERVICO]} current="all" />);

    fireEvent.click(acoesDe("Console retrô"));
    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual(["Cancelar"]);
    fireEvent.keyDown(acoesDe("Console retrô"), { key: "Escape" });

    fireEvent.click(acoesDe("Serviço de reparo"));
    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual(["Cancelar"]);
  });

  it("nao oferece nenhuma acao num item cancelado", () => {
    render(<ItemsList items={[CANCELADO]} current="all" />);

    // Um menu vazio e um beco sem saida: melhor nao ter gatilho.
    expect(screen.queryByRole("button", { name: "Ações de Monitor quebrado" })).toBeNull();
  });

  it("manda o id do item para a action escolhida, e so para ela", async () => {
    render(<ItemsList items={[BICICLETA, CONSOLE]} current="all" />);

    fireEvent.click(acoesDe("Bicicleta"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Publicar" }));

    expect(mocks.publicar).toHaveBeenCalledTimes(1);
    // ponytail: o primeiro argumento e o `prev` que o `items-list` amarra com
    // `bind(null, null)`; o segundo e o FormData com o `id` no input hidden.
    const [prev, dados] = mocks.publicar.mock.calls[0] as [null, FormData];
    expect(prev).toBeNull();
    expect(dados.get("id")).toBe("i-bicicleta");
    expect(mocks.excluir).not.toHaveBeenCalled();
    expect(mocks.cancelar).not.toHaveBeenCalled();
  });

  it("manda o id do item para Cancelar, e nao para Publicar", async () => {
    render(<ItemsList items={[CONSOLE]} current="all" />);

    fireEvent.click(acoesDe("Console retrô"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Cancelar" }));

    expect(mocks.cancelar).toHaveBeenCalledTimes(1);
    const [, dados] = mocks.cancelar.mock.calls[0] as [null, FormData];
    expect(dados.get("id")).toBe("i-console");
    expect(mocks.publicar).not.toHaveBeenCalled();
  });
});

describe("ItemsList — o filtro de status é da URL, não da tabela", () => {
  // ponytail: `current="draft"` com as tres linhas e o estado de hoje depois da
  // remocao do filtro client-side: quem filtra por status e a pagina, pelo
  // `searchParams`, antes de o `ItemsList` existir. Refiltrar aqui seria o
  // defeito — com paginacao no servidor a tabela receberia so uma pagina e o
  // filtro local a esvaziaria. A segunda metade do teste e a prova de que a
  // tabela nao travou: a busca global ainda acha "Console" com a aba de rascunho
  // marcada.
  it("mostra as linhas que o pai mandou, com a aba de rascunho ativa", async () => {
    vi.useFakeTimers();
    try {
      render(<ItemsList items={DESORDENADOS} current="draft" />);
      expect(titulos()).toEqual(["Console retrô", "Bicicleta", "Serviço de reparo"]);

      fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "Console" } });
      await avancarRelogio(400);

      expect(titulos()).toEqual(["Console retrô"]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("ItemsList — modo servidor", () => {
  it("conta o total do servidor no rodapé, e nao o tamanho da página", () => {
    render(<ItemsList items={[BICICLETA, CONSOLE]} current="all" totalCount={100} pageIndex={2} />);

    // A janela e a da pagina 2 com 10 por pagina (o padrao do DataTable): o que
    // distingue "o servidor conta" de "a tabela conta" e o 100.
    expect(screen.getByText("Mostrando 21–30 de 100 itens")).toBeTruthy();
  });

  it("deixa a pagina com o pai: trocar de pagina nao refata a lista", () => {
    const onPageChange = vi.fn();
    render(
      <ItemsList
        items={[BICICLETA, CONSOLE]}
        current="all"
        totalCount={100}
        pageIndex={2}
        onPageChange={onPageChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    expect(onPageChange).toHaveBeenLastCalledWith(3);
    expect(titulos()).toEqual(["Bicicleta", "Console retrô"]);
  });
});
