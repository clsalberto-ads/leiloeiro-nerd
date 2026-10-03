// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { DashboardItemRow } from "./dashboard-item-row";
import type { DashboardTableView } from "./dashboard-table-state";

// ponytail: a action real (drizzle/pg/better-auth) arrastaria o banco para
// dentro do grafo de import — o mesmo motivo do `vi.mock` em
// `items-list.test.tsx`. Os mocks vivem no `vi.hoisted` porque a assercao
// acontece no arquivo de teste e nao no modulo: o `vi.mock` troca o simbolo
// importado, o `vi.fn()` solto na factory nao seria legivel daqui.
const mocks = vi.hoisted(() => ({
  cancelar: vi.fn(),
  excluir: vi.fn(),
  publicar: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/presentation/actions/item-actions", () => ({
  cancelItemAction: mocks.cancelar,
  deleteItemAction: mocks.excluir,
  publishItemAction: mocks.publicar,
}));

// ponytail: o `next/navigation` e mockado para o `ItemsUrl`, e nao para o
// `ItemsList` — que e puro de proposito e nao importa nada de roteador. E a
// emenda da cadeia: o `ItemsList` devolve a VISTA, o `ItemsUrl` vira string e o
// `router.push` recebe. Sem este mock, `useRouter` fora do App Router e um
// `invariant` na hora do render.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: mocks.push }),
}));

// ponytail: o `BidCountdown` e um relogio (`setInterval` + `Date.now`) e o unico
// lugar onde a data limite vira "5 d 12 h 0 min 0 s". Deixalo real aqui trocaria
// o texto asserido da celula de prazo por uma contagem viva; o contrato dele
// (receber o `bidDeadline` do item ativo) ja e guardado pelo
// `items-list.test.tsx`, que roda o componente de verdade.
vi.mock("@/components/bid-countdown", () => ({ BidCountdown: () => null }));

import { act, cleanup, fireEvent, render, screen, within } from "@/test/dom-render";
import { ItemsList, ItemsUrl } from "./items-list";
import { DEFAULT_TABLE_VIEW } from "./dashboard-table-state";

// ponytail: meio-dia UTC. O texto da data e formatado no fuso do produto, e
// 12:00 UTC e a hora que cai no mesmo dia civil tanto em UTC quanto em
// America/Sao_Paulo — assim o resto do arquivo nao depende da maquina. O
// `01/10/2026` continua o esperado; o fuso se prova no teste que troca `TZ` de
// verdade, porque para provar o fuso do produto e preciso um instante em que UTC
// e Sao Paulo discordem do dia.
const DEADLINE = new Date("2026-10-01T12:00:00Z");

// ponytail: o item do teste e o DTO de seis campos e nao o `Item` de doze. Montar
// o `Item` completo aqui seria mais honesto sobre a origem, mas ai o `Item` do
// teste passaria a depender de campos que a lista nao le — e o teste pararia de
// dizer o que a lista precisa. Aqui ele diz exatamente isso: estes seis campos, e
// nenhum outro, sao o que a tela consome.
function makeItem(overrides: Partial<DashboardItemRow> = {}): DashboardItemRow {
  return {
    id: "i1",
    title: "Console retrô",
    type: "product",
    minInitialBid: 10000,
    bidDeadline: DEADLINE,
    status: "active",
    ...overrides,
  };
}

const CONSOLE = makeItem({ id: "i-console", minInitialBid: 123456 });
const BICICLETA = makeItem({ id: "i-bicicleta", title: "Bicicleta", type: "piece", minInitialBid: 5000, status: "draft" });
const SERVICO = makeItem({ id: "i-servico", title: "Serviço de reparo", type: "service", minInitialBid: 100000, status: "closed" });
const CANCELADO = makeItem({ id: "i-cancelado", title: "Monitor quebrado", status: "cancelled" });
const DESORDENADOS = [CONSOLE, BICICLETA, SERVICO];

// ponytail: o instante exato que o `item-form` produz quando o vendedor digita
// "30/09 22:00" no `datetime-local`: o `new Date(...)` local de um servidor em
// UTC vira `2026-10-01T01:00Z`. E o unico tipo de instante em que o fuso do
// processo muda o DIA visivel — 01:00 UTC ainda e 30/09 as 22h em Sao Paulo, e
// 01/10 as 22h em qualquer fuso a leste. Por isso o prazo deste item nao serve
// aos outros testes.
const BOUNDARY_DEADLINE = new Date("2026-10-01T01:00:00Z");

type Navigate = (view: DashboardTableView) => void;

// ponytail: `navigate` e um `vi.fn()` e nao um `useRouter` mockado porque o
// contrato da lista e a VISTA, e nao a string que o Next receberia. O roteador
// so aparece na pagina, e la a assercao e sobre `router.push` (ver
// `ItemsUrl — o clique vira URL`, no fim deste arquivo).
//
// `responder` devolve a mesma arvore com outra prop `vista`, que e o que o servidor
// faz depois de um `router.push` (e o que o "voltar" do navegador faz sem navegacao
// nenhuma). Sem ele nao ha como testar a garantia de que a prop NUNCA vira
// navegacao — o que seria o laco de "navegou, a prop voltou, navegou de novo".
function renderList(entrada: { items?: DashboardItemRow[]; view?: DashboardTableView; totalCount?: number } = {}): {
  navigate: Mock<Navigate>;
  responder: (view: DashboardTableView) => void;
} {
  const navigate = vi.fn<Navigate>();
  const list = (view: DashboardTableView) => (
    <ItemsList
      items={entrada.items ?? DESORDENADOS}
      view={view}
      totalCount={entrada.totalCount ?? DESORDENADOS.length}
      navigate={navigate}
    />
  );
  const { rerender } = render(list(entrada.view ?? DEFAULT_TABLE_VIEW));
  return { navigate, responder: (view) => rerender(list(view)) };
}

// ponytail: a navegacao sai num `queueMicrotask` (o `ItemsList` junta assim as
// mudancas que o `DataTable` dispara em pares), e o `fireEvent` do Testing Library
// e sincrono: sem um `await act` depois do gesto, a assercao rodaria antes de a
// navegacao existir — e o teste passaria medindo o nada. O `await` no `act`
// assincrono e o que da a volta: ele espera a fila de microtasks antes de
// devolver. A segunda volta (`acao vazia`) existe para o caso do debounce, cujo
// timer dentro do `act` enfileira a navegacao por ultimo.
async function acao(gesto: () => void, ms = 0): Promise<void> {
  await act(async () => {
    gesto();
    if (ms > 0) await vi.advanceTimersByTimeAsync(ms);
  });
  await act(async () => {});
}

function lastView(navigate: Mock<Navigate>): DashboardTableView {
  expect(navigate, "a lista nao navegou").toHaveBeenCalledTimes(1);
  const [view] = navigate.mock.calls[0] as [DashboardTableView];
  return view;
}

// ponytail: `getAllByRole("row")` sem escopo devolveria tambem a linha do
// cabecalho (o `thead` tambem e `role="row"`), entao a primeira linha seria o
// titulo das colunas e nunca o titulo de um item.
function corpo(): HTMLElement {
  const element = document.querySelector("tbody");
  expect(element, "tabela renderizada sem tbody").not.toBeNull();
  return element as HTMLElement;
}

function linhas(): HTMLElement[] {
  return within(corpo()).getAllByRole("row");
}

function celulas(row: HTMLElement): string[] {
  return within(row).getAllByRole("cell").map((cell) => cell.textContent ?? "");
}

function titulos(): string[] {
  return linhas().map((row) => celulas(row)[0] ?? "");
}

function singleRow(): HTMLElement {
  const todas = linhas();
  expect(todas, "tabela sem linha de item").toHaveLength(1);
  return todas[0];
}

function cabecalho(name: string): HTMLElement {
  return screen.getByRole("columnheader", { name: name });
}

function sortButton(name: string): HTMLElement {
  return within(cabecalho(name)).getByRole("button", { name: name });
}

function actionsFrom(titulo: string): HTMLElement {
  return screen.getByRole("button", { name: `Ações de ${titulo}` });
}

// ponytail: os mocks das actions vivem no modulo do arquivo, entao as chamadas
// de um teste sobrariam no seguinte e o `not.toHaveBeenCalled()` de "so para ela"
// viraria uma asercao sobre o teste anterior — sempre verdadeira, nunca uma
// falha real.
beforeEach(() => {
  vi.clearAllMocks();
});

// ponytail: o `cleanup()` no fim e o que permite dois renders no mesmo `it`.
// Sem ele as duas tabelas ficariam no `document` e `unicaLinha()` veria quatro
// celulas (o `afterEach` do `dom-render` so roda no fim do teste).
function readDeadline(item: DashboardItemRow): string {
  renderList({ items: [item] });
  const text = within(singleRow()).getByText(/\d{2}\/\d{2}\/\d{4}/).textContent ?? "";
  cleanup();
  return text;
}

describe("ItemsList — as colunas da tabela", () => {
  // ponytail: a lista exata de cabecalhos, e nao "um cabecalho por vez": e o que
  // acusa a coluna que some (a ordem das outras se desloca) e a coluna nova que
  // aparece. A ordem e uma decisao de produto — o olho le da esquerda para a
  // direita, o titulo abre a linha — entao mudar e um ato consciente.
  it("mostra exatamente as seis colunas acordadas, na ordem", () => {
    renderList({ items: [CONSOLE] });

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
    renderList({ items: [CONSOLE] });

    // ponytail: a celula de acoes entra como string vazia — o gatilho dela e um
    // botao so com icone, e o nome dele e o `aria-label`, nao texto. A string
    // vazia e o que prova que a celula existe mesmo sem texto legivel.
    expect(celulas(singleRow())).toEqual([
      "Console retrô",
      "Produto",
      "Em leilão",
      "R$ 1.234,56",
      "01/10/2026",
      "",
    ]);
  });

  it("traduz o tipo do item para pt-BR", () => {
    renderList();

    expect(linhas().map(celulas).map((c) => c[1])).toEqual([
      "Produto",
      "Peça colecionável",
      "Serviço",
    ]);
  });

  it("usa o ItemStatusBadge na celula de status, nao um texto solto", () => {
    renderList();

    // ponytail: `data-slot="badge"` e o que separa o `Badge` do shadcn de um
    // `<span>` montado a mao — o rotulo ("Em leilao") sozinho passaria nos dois.
    for (const label of ["Em leilão", "Rascunho", "Encerrado"]) {
      expect(within(corpo()).getByText(label).getAttribute("data-slot")).toBe("badge");
    }
  });

  it("formata o lance minimo em reais, e nao em centavos crus", () => {
    renderList({ items: [CONSOLE] });

    // ponytail: 123456 centavos. O ponto e a virgula so saem do `formatReais`: o
    // numero cru renderizaria "123456". A busca e por texto, e nao por indice de
    // celula, para a falha dizer o que sumiu em vez de acusar a coluna vizinha.
    expect(within(singleRow()).getByText("R$ 1.234,56")).toBeTruthy();
  });

  it("formata o prazo em data pt-BR dentro de um elemento time", () => {
    renderList({ items: [CONSOLE] });

    const tempo = within(singleRow()).getByText("01/10/2026");
    expect(tempo.tagName).toBe("TIME");
    // ponytail: o `datetime` e o instante em UTC, independente do fuso — e ele
    // que acusa um `toISOString` trocado pelo texto ja formatado, caso em que o
    // "01/10/2026" continuaria igual e o teste passaria.
    expect(tempo.getAttribute("datetime")).toBe("2026-10-01T12:00:00.000Z");
  });

  // ponytail: este e o teste que prova o fuso, e ele troca `process.env.TZ` de
  // verdade em vez de confiar na maquina. O instante (`2026-10-01T01:00Z`) e o
  // que o `item-form` submete quando o vendedor digita "30/09 22:00": e o dia
  // diverge entre UTC e Sao Paulo, entao um `toLocaleDateString` sem `timeZone`
  // imprime "01/10" com o processo em UTC e "30/09" com o processo em Sao Paulo
  // — dois textos para o mesmo instante. A celula e SSR'd e re-renderizada no
  // cliente, entao essa divergencia e tambem um erro de hidratacao: o React
  // acusa o texto do `<time>` e joga fora a arvore do servidor. O `TZ` volta ao
  // valor original no `finally` porque o resto do arquivo depende dele.
  it("formata o prazo no fuso do produto, e nao no fuso do processo", () => {
    const originalTimezone = process.env.TZ;
    const item = makeItem({ id: "i-fuso", bidDeadline: BOUNDARY_DEADLINE });
    try {
      process.env.TZ = "UTC";
      const withServerUtc = readDeadline(item);
      process.env.TZ = "America/Sao_Paulo";
      const withServerSaoPaulo = readDeadline(item);

      expect(withServerUtc).toBe("30/09/2026");
      expect(withServerSaoPaulo).toBe("30/09/2026");
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });

  it("liga o titulo da coluna ao editor daquele item", () => {
    renderList({ items: [CONSOLE, BICICLETA] });

    const link = within(linhas()[0]).getByRole("link", { name: "Console retrô" });
    expect(link.getAttribute("href")).toBe("/dashboard/items/i-console/edit");
  });
});

describe("ItemsList — as colunas que ordenam", () => {
  // ponytail: sao TRES colunas ordenaveis e nao cinco, e o criterio e o mesmo sinal
  // que o usuario ve: `aria-sort` no cabecalho, que so existe em coluna
  // ordenavel. `Tipo` e `Status` sairam da lista porque nao existe `orderBy` que
  // as ordene no servidor — a union e `createdAt | title | minInitialBid |
  // bidDeadline` — e uma coluna clicavel sem `orderBy` escreveria um
  // `?orderBy=status` que o leitor trocaria de volta para `createdAt desc`: a seta
  // animaria e a tabela voltaria igual. `Ações` esta fora por outro motivo, ja
  // antigo: botao e link nao tem valor de acesso nem ordem.
  it("ordena as tres colunas de dado e deixa Tipo, Status e Ações fora", () => {
    renderList();

    const ordenaveis = screen
      .getAllByRole("columnheader")
      .filter((th) => th.getAttribute("aria-sort") !== null);
    expect(ordenaveis.map((th) => th.textContent)).toEqual([
      "Título",
      "Lance mínimo",
      "Deadline",
    ]);
    for (const name of ["Tipo", "Status", "Ações"]) {
      expect(cabecalho(name).getAttribute("aria-sort")).toBeNull();
      expect(within(cabecalho(name)).queryByRole("button")).toBeNull();
    }
  });

  // ponytail: este e o teste do "a URL manda na seta". Todos os outros provam que
  // o clique vira URL; este prova o caminho de volta — que a seta desenhada na tela
  // e a coluna que o servidor usou. A mutacao que mata aqui e `sort={null}` no
  // `DataTable`: a lista continuaria mandando as URLs certas ao clicar e nenhum
  // teste de navegacao notaria, mas a tela mostraria os itens ja ordenados sem
  // nenhuma seta apontando para onde — o estado na URL sem reflexo na tela.
  it("marca a coluna que a URL mandou ordenar, e so ela", () => {
    renderList({ view: { ...DEFAULT_TABLE_VIEW, orderBy: "minInitialBid", direction: "desc" } });

    expect(cabecalho("Lance mínimo").getAttribute("aria-sort")).toBe("descending");
    for (const name of ["Título", "Deadline"]) {
      expect(cabecalho(name).getAttribute("aria-sort")).toBe("none");
    }
  });

  // ponytail: e o caso inverso, que e o da primeira visita. A tela padrao ordena por
  // `createdAt`, que NAO tem coluna — entao nenhuma `aria-sort` pode ficar "active".
  // Se uma coluna aparecesse marcada aqui, a tela estaria jurando que a ordem
  // default e por titulo, e so o `ORDER BY` do servidor discordaria.
  it("nao marca nenhuma coluna na tela padrão, que ordena por data de criação", () => {
    renderList();

    const marcadas = screen
      .getAllByRole("columnheader")
      .filter((th) => th.getAttribute("aria-sort") === "ascending" || th.getAttribute("aria-sort") === "descending");
    expect(marcadas).toEqual([]);
  });

  // ponytail: o `it.each` e o que amarra a COLUNA DA TELA ao `orderBy` DO SERVIDOR,
  // que e o par que o click atravessa. Um mapeamento trocado (id "bidDeadline" indo para
  // `minInitialBid`) e silencioso: a seta aparece, a URL muda, e so quem sabe o
  // mapeamento le o resultado. E `Lance mínimo -> minInitialBid` e o caso que
  // importa: e a coluna que precisa dizer "dinheiro" para o `ORDER BY` classificar
  // por numero e nao pelo texto formatado (a ordem de texto seria
  // "1.000,00" < "1.234,56" < "50,00").
  //
  // A primeira direcao nao e a mesma nas tres colunas, e quem decide e o
  // `getAutoSortDir` do TanStack: ele sobe para valor de TEXTO e desce para NUMERO.
  // Por isso `Título` comeca em `asc` e as duas colunas de numero em `desc`. E
  // herdado, nao escolhido: a URL manda o que o primeiro clique produziu, e o
  // ciclo de dois cliques cobre as duas direcoes de qualquer coluna.
  it.each([
    ["Título", "title", "asc"],
    ["Lance mínimo", "minInitialBid", "desc"],
    ["Deadline", "bidDeadline", "desc"],
  ])("manda %s para o orderBy %s com direcao %s", async (column, orderBy, direction) => {
    const { navigate } = renderList();

    await acao(() => fireEvent.click(sortButton(column)));

    expect(lastView(navigate)).toEqual({ ...DEFAULT_TABLE_VIEW, orderBy, direction });
  });

  // ponytail: o segundo clique inverte, e o terceiro (o "sem ordenacao" do
  // TanStack) VOLTA A VISTA PADRAO em vez de deixar a seta sumir. E nao uma escolha
  // de rotulo: a URL nao tem como representar "sem ordenacao" — sem parametro a
  // leitura assume `createdAt desc` — entao a tela sempre esta ordenada por alguma
  // coisa, e a seta sumindo seria o unico estado que a URL nao sabe descrever.
  it("inverte a direcao no segundo clique e volta ao padrao no terceiro", async () => {
    const { navigate } = renderList();

    await acao(() => fireEvent.click(sortButton("Título")));
    expect(lastView(navigate).direction).toBe("asc");

    navigate.mockClear();
    await acao(() => fireEvent.click(sortButton("Título")));
    expect(lastView(navigate)).toEqual({ ...DEFAULT_TABLE_VIEW, orderBy: "title", direction: "desc" });

    navigate.mockClear();
    await acao(() => fireEvent.click(sortButton("Título")));
    expect(lastView(navigate)).toEqual(DEFAULT_TABLE_VIEW);
  });

  it("nao reordena a pagina do servidor: ordena e a URL que decide", async () => {
    const { navigate } = renderList();

    await acao(() => fireEvent.click(sortButton("Lance mínimo")));

    // ponytail: as tres linhas continuam na ordem que o servidor mandou. Um
    // reordenamento local mostraria um fragmento ordenado que nao corresponde a
    // nenhum conjunto de dados, e a segunda pagina viraria do conjunto errado.
    expect(titulos()).toEqual(["Console retrô", "Bicicleta", "Serviço de reparo"]);
    expect(lastView(navigate).orderBy).toBe("minInitialBid");
  });

  it("volta para a primeira pagina quando a ordenacao muda", async () => {
    const { navigate } = renderList({ view: { ...DEFAULT_TABLE_VIEW, page: 4 } });

    await acao(() => fireEvent.click(sortButton("Deadline")));

    expect(lastView(navigate)).toEqual({
      ...DEFAULT_TABLE_VIEW,
      orderBy: "bidDeadline",
      direction: "desc",
      page: 1,
    });
  });
});

describe("ItemsList — as acoes por status", () => {
  it("oferece Publicar e Excluir num rascunho", async () => {
    renderList({ items: [BICICLETA] });

    fireEvent.click(actionsFrom("Bicicleta"));

    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
      "Publicar",
      "Excluir",
    ]);
  });

  it("oferece Cancelar num item em leilao e num encerrado", async () => {
    renderList({ items: [CONSOLE, SERVICO] });

    fireEvent.click(actionsFrom("Console retrô"));
    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual(["Cancelar"]);
    fireEvent.keyDown(actionsFrom("Console retrô"), { key: "Escape" });

    fireEvent.click(actionsFrom("Serviço de reparo"));
    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual(["Cancelar"]);
  });

  it("nao oferece nenhuma acao num item cancelado", () => {
    renderList({ items: [CANCELADO] });

    // ponytail: um menu vazio e um beco sem saida: melhor nao ter gatilho.
    expect(screen.queryByRole("button", { name: "Ações de Monitor quebrado" })).toBeNull();
  });

  it("manda o id do item para a action escolhida, e so para ela", async () => {
    renderList({ items: [BICICLETA, CONSOLE] });

    fireEvent.click(actionsFrom("Bicicleta"));
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
    renderList({ items: [CONSOLE] });

    fireEvent.click(actionsFrom("Console retrô"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Cancelar" }));

    expect(mocks.cancelar).toHaveBeenCalledTimes(1);
    const [, dados] = mocks.cancelar.mock.calls[0] as [null, FormData];
    expect(dados.get("id")).toBe("i-console");
    expect(mocks.publicar).not.toHaveBeenCalled();
  });
});

describe("ItemsList — a busca e do servidor, a tabela nao refiltra", () => {
  // ponytail: o teste que substituiu "a busca acha o rotulo na celula" e "o filtro
  // de status e do pai". Os dois mediam o `accessorFn` entregando o rotulo pt-BR
  // para o filtro do `DataTable` — e esse filtro nao roda mais nesta tela, porque
  // no modo servidor quem filtra e o SQL. O contrato do `q` (casar com o rotulo de
  // status e de tipo, insensivel a acento) continua testado onde ele acontece
  // agora, em `drizzle-item-repository.test.ts`, com o `CASE` de rotulos dentro do
  // `WHERE`. O que sobra para a tela e o que este bloco mede: a busca AVISA a URL
  // e a tabela nao finge ter filtrado.
  it("manda o termo para a URL e deixa a pagina do servidor como esta", async () => {
    vi.useFakeTimers();
    try {
      const { navigate } = renderList();

      await acao(() => fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "Console" } }), 400);

      expect(lastView(navigate)).toEqual({ ...DEFAULT_TABLE_VIEW, q: "Console" });
      // ponytail: as tres linhas continuam. A tabela recebeu uma pagina de 3
      // linhas de um conjunto de 3; filtrar aqui daria "Console" e o rodape
      // continuaria anunciando 3 de 3 — a tela mentindo sobre o tamanho do
      // conjunto que o servidor contou.
      expect(titulos()).toEqual(["Console retrô", "Bicicleta", "Serviço de reparo"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("nao avisa a URL antes do debounce, e nao avisa ao abrir", async () => {
    vi.useFakeTimers();
    try {
      const { navigate } = renderList();

      await acao(() => fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "Con" } }), 200);
      expect(navigate).not.toHaveBeenCalled();

      await acao(() => {}, 200);
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(lastView(navigate).q).toBe("Con");
    } finally {
      vi.useRealTimers();
    }
  });

  it("abre a caixa ja com o termo que veio da URL", () => {
    renderList({ view: { ...DEFAULT_TABLE_VIEW, q: "Console" } });

    expect((screen.getByLabelText("Buscar") as HTMLInputElement).value).toBe("Console");
  });

  it("volta para a primeira pagina quando a busca muda", async () => {
    vi.useFakeTimers();
    try {
      const { navigate } = renderList({ view: { ...DEFAULT_TABLE_VIEW, page: 3 } });

      await acao(() => fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "x" } }), 400);

      expect(lastView(navigate)).toEqual({ ...DEFAULT_TABLE_VIEW, q: "x", page: 1 });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("ItemsList — as abas leem o status da URL", () => {
  it("marca a aba que esta na URL, e so ela", () => {
    renderList({ view: { ...DEFAULT_TABLE_VIEW, status: "draft" } });

    const abas = screen.getAllByRole("link");
    const ativa = abas.filter((aba) => (aba.getAttribute("class") ?? "").includes("bg-primary"));
    expect(ativa.map((aba) => aba.textContent)).toEqual(["Rascunho"]);
  });

  it("marca Todos quando a URL nao filtra por status", () => {
    renderList();

    const ativa = screen
      .getAllByRole("link")
      .filter((aba) => (aba.getAttribute("class") ?? "").includes("bg-primary"));
    expect(ativa.map((aba) => aba.textContent)).toEqual(["Todos"]);
  });

  // ponytail: a aba e um link, entao a URL dela e assercao de HTML — e nao de
  // callback. A aba "Em leilao" a partir de uma vista com busca e pagina tem de
  // produzir `?status=active&pageSize=20`: o status novo, sem a busca antiga, sem
  // a pagina 4 que nao existe mais, e COM o tamanho de pagina que o usuario
  // escolheu (que e escolha independente do filtro).
  it("zera busca e pagina ao trocar de aba, e guarda o tamanho escolhido", () => {
    renderList({ view: { ...DEFAULT_TABLE_VIEW, q: "Console", page: 4, pageSize: 20 } });

    const emLeilao = screen.getByRole("link", { name: "Em leilão" });
    expect(emLeilao.getAttribute("href")).toBe("/dashboard/items?status=active&pageSize=20");
    expect(screen.getByRole("link", { name: "Todos" }).getAttribute("href")).toBe(
      "/dashboard/items?pageSize=20",
    );
  });
});

describe("ItemsList — a paginação é do servidor", () => {
  // ponytail: a janela e a da pagina 3 com 10 por pagina (o padrao do `DataTable`): o
  // que distingue "o servidor conta" de "a tabela conta" e o 100.
  it("conta o total do servidor no rodapé, e nao o tamanho da página", () => {
    renderList({ items: [BICICLETA, CONSOLE], view: { ...DEFAULT_TABLE_VIEW, page: 3 }, totalCount: 100 });

    expect(screen.getByText("Mostrando 21–30 de 100 itens")).toBeTruthy();
  });

  it("manda a proxima pagina para a URL, em numero de pagina e nao de indice", async () => {
    const { navigate } = renderList({ totalCount: 100 });

    await acao(() => fireEvent.click(screen.getByRole("button", { name: "Próxima" })));

    // ponytail: o `DataTable` fala em indice (0, 1, 2) porque e o indice do
    // TanStack, e a URL fala em pagina (1, 2, 3) porque e o que a pessoa le. O
    // `+ 1` mora no `ItemsList`, e este e o teste que trava a borda: sem ele a
    // primeira pagina da URL seria 0 e o `page=0` voltaria como 1.
    expect(lastView(navigate)).toEqual({ ...DEFAULT_TABLE_VIEW, page: 2 });
  });

  // ponytail: este e o teste do `queueMicrotask`. Trocar o tamanho na pagina 3 de
  // 10 faz o `DataTable` chamar DOIS callbacks no mesmo tick — `onPageChange` com
  // a pagina reposicionada e `onPageSizeChange` com o tamanho novo. Sem o
  // agrupamento seriam dois `router.push`, e o segundo venceria a URL com a
  // prop `pageSize` antiga; com ele, uma navegacao so, com os dois campos certos.
  it("trocar o tamanho e a pagina de uma vez vira uma navegacao so", async () => {
    const { navigate } = renderList({ items: [BICICLETA, CONSOLE], view: { ...DEFAULT_TABLE_VIEW, page: 3 }, totalCount: 100 });

    // ponytail: abrir o `Select` e um `act` a parte porque o popup so existe DEPOIS
    // do re-render do gatilho, e dentro do mesmo `act` a busca do `option` rodaria
    // contra o DOM de antes da abertura. A selecao e o que dispara o par de
    // callbacks, e ela inteira dentro de um `act`.
    await acao(() => fireEvent.click(screen.getByRole("combobox", { name: "Linhas por página" })));
    await acao(() => {
      const opcao = screen.getByRole("option", { name: "50" });
      fireEvent.pointerDown(opcao);
      fireEvent.click(opcao);
    });

    // ponytail: a conta e a do `setPageSize` do proprio TanStack, e nao um clamp
    // na ultima pagina: com 10 por pagina na pagina 3 as linhas 21–30 sao as
    // primeiras visiveis depois de 50 (floor(10 * 2 / 50) + 1 = 1), entao a
    // primeira linha continua na tela. E o que distingue esta implementacao de
    // um `Math.ceil` ingênuo, que mandaria o usuario para a ultima pagina e
    // perderia o lugar.
    expect(lastView(navigate)).toEqual({ ...DEFAULT_TABLE_VIEW, page: 1, pageSize: 50 });
  });

  it("usa o pageSize do pai como tamanho em uso", () => {
    renderList({ items: [BICICLETA, CONSOLE], view: { ...DEFAULT_TABLE_VIEW, pageSize: 50 } });

    expect(screen.getByRole("combobox", { name: "Linhas por página" }).textContent).toContain("50");
  });

  it("nao refaz a janela do servidor nem ao trocar de pagina", async () => {
    renderList({ totalCount: 100 });

    await acao(() => fireEvent.click(screen.getByRole("button", { name: "Próxima" })));

    // ponytail: quem guarda a janela e o `pageIndex` que o pai passou, entao o
    // `props.vista` do clique continua valendo ate a resposta do servidor. Um
    // fatiamento local aqui mostraria as linhas 11–20 de um `data` que so tem 3
    // linhas: a tabela vazia com o rodape dizendo "11–20 de 100".
    expect(titulos()).toEqual(["Console retrô", "Bicicleta", "Serviço de reparo"]);
  });

  // ponytail: o par que fecha o laco de navegacao, e o teste que uma reescrita por
  // efeito derrubaria primeiro. A tela que escreve sozinha na URL entra em laco
  // infinito no App Router: o `push` traz a prop de volta (a resposta do servidor),
  // a prop de volta dispara o `push`, e o browser consome renderizacao sem ninguem
  // ter clicado. A garantia e o oposto do que o nome sugere — a prop NUNCA navega,
  // so RECONTA. Por isso o teste empurra a prop que o servidor devolveria e exige
  // que `navigate` continue com uma unica chamada.
  it("nao navega de novo quando a vista que o pai devolve e a que foi pedida", async () => {
    const { navigate, responder } = renderList({ totalCount: 100 });

    await acao(() => fireEvent.click(screen.getByRole("button", { name: "Próxima" })));
    const pedida = lastView(navigate);
    expect(pedida).toEqual({ ...DEFAULT_TABLE_VIEW, page: 2 });

    await acao(() => responder(pedida));

    expect(navigate).toHaveBeenCalledTimes(1);
  });

  // ponytail: o outro lado da mesma garantia, e o teste que impede a lista de
  // navegar sobre uma tela velha. A base de cada mudanca e a PROP — nao uma copia
  // guardada em ref — e a unica forma de ver isso e mexer num campo que o GESTO nao
  // escreve: `page` e sempre setado, entao um "proximo" sairia certo mesmo com a
  // base velha. `q` e `status` nao sao escritos pelo "proxima", entao so eles
  // denunciam a copia desatualizada (com ela, o filtro e a busca sumiriam sozinhos
  // na segunda pagina — o mesmo defeito de "a busca continua filtrando depois que eu
  // limpei o campo", ao contrario).
  it("preserva a busca e a aba que o pai devolveu no clique seguinte", async () => {
    const { navigate, responder } = renderList({ totalCount: 100 });

    // o que o servidor devolve depois de um filtro novo
    await acao(() => responder({ ...DEFAULT_TABLE_VIEW, q: "console", status: "active" }));

    await acao(() => fireEvent.click(screen.getByRole("button", { name: "Próxima" })));

    expect(lastView(navigate)).toEqual({
      ...DEFAULT_TABLE_VIEW,
      q: "console",
      status: "active",
      page: 2,
    });
  });
});

// ponytail: aqui a assercao e sobre a STRING, e nao sobre a vista. E o unico teste
// da cadeia inteira que fecha no roteador: ate aqui os outros provam "o clique
// produz a vista certa" e "a pagina lê a URL", e este prova a emenda — a string
// que sai daqui e a mesma que a `ItemsPage` vai ler de volta. Um `buildDashboardHref` com
// os parametros fora de ordem, ou com `page=1` escrito, quebraria a equivalencia
// `le(buildDashboardHref(v)) === v` sem nenhum teste de vista notar.
describe("ItemsUrl — o clique vira URL", () => {
  // ponytail: a string tem que ser `?orderBy=title` e nao `?orderBy=title&direction=asc`
  // — a direcao `asc` e omitida porque e a que o leitor assume quando `orderBy`
  // foi escrito, e a `page=1` some pelo mesmo motivo (a primeira e a padrao). A URL
  // curta e o que faz o link colado no chat continuar funcionando quando a tela
  // mudar; a equivalencia round-trip e o que garante que ela volta igual.
  it("manda a coluna escolhida como a URL mais curta que a descreve", async () => {
    render(<ItemsUrl items={DESORDENADOS} view={DEFAULT_TABLE_VIEW} totalCount={100} />);

    await acao(() => fireEvent.click(sortButton("Título")));

    expect(mocks.push).toHaveBeenCalledWith("/dashboard/items?orderBy=title");
  });

  // ponytail: aqui a direcao APARECE (`direction=desc`) e no teste da coluna de
  // texto ela sumia, e a diferenca e a regra do leitor: `orderBy` escrito sem
  // `direction` significa "a ordem natural da coluna", que para `title` e asc e
  // para `minInitialBid` e desc. Sem o parametro, esta URL voltaria como
  // `minInitialBid asc` — dinheiro do MENOR para o maior, o contrario do clique.
  it("leva busca, aba e tamanho, e joga fora a pagina que a coluna nova invalida", async () => {
    render(
      <ItemsUrl
        items={DESORDENADOS}
        view={{ ...DEFAULT_TABLE_VIEW, q: "console", status: "active", page: 4, pageSize: 50 }}
        totalCount={100}
      />,
    );

    await acao(() => fireEvent.click(sortButton("Lance mínimo")));

    expect(mocks.push).toHaveBeenCalledWith(
      "/dashboard/items?q=console&status=active&orderBy=minInitialBid&direction=desc&pageSize=50",
    );
  });

  it("leva a pagina que o botao pediu, ja em numero de pagina", async () => {
    render(<ItemsUrl items={DESORDENADOS} view={DEFAULT_TABLE_VIEW} totalCount={100} />);

    await acao(() => fireEvent.click(screen.getByRole("button", { name: "Próxima" })));

    expect(mocks.push).toHaveBeenCalledWith("/dashboard/items?page=2");
  });
});
