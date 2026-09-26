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

import { act, cleanup, fireEvent, render, screen, within } from "@/test/dom-render";
import { ItemsList } from "./items-list";

// ponytail: meio-dia UTC. O texto da data e formatado no fuso do produto, e
// 12:00 UTC e a hora que cai no mesmo dia civil tanto em UTC quanto em
// America/Sao_Paulo — assim o resto do arquivo nao depende da maquina. O
// `01/10/2026` continua o esperado; o fuso se prova no teste que troca `TZ` de
// verdade, porque para provar o fuso do produto e preciso um instante em que UTC
// e Sao Paulo discordem do dia.
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

// ponytail: os três status aqui estão escolhidos porque o rótulo pt-BR e o enum
// inglês discordam sobre eles. Em ordem alfabética o rótulo dá
// "Cancelado" < "Em leilão" < "Rascunho" e o enum dá
// "active" < "cancelled" < "draft" — a troca de `active` por `cancelled` na
// frente já basta para as duas ordens diferirem. O par "Em leilão"/"Rascunho"
// (active e draft) NÃO serviria: nos dois idiomas o active vem primeiro, e a
// mutação do `accessorFn` passaria verde.
const ATIVO = makeItem({ id: "i-ativo", title: "Teclado mecânico", status: "active" });
const CANCELADO_ITEM = makeItem({ id: "i-cancelado-item", title: "Impressora jato", status: "cancelled" });
const RASCUNHO = makeItem({ id: "i-rascunho", title: "Cadeira gamer", status: "draft" });
const POR_STATUS = [ATIVO, CANCELADO_ITEM, RASCUNHO];

// ponytail: os tres prazos caem em meses diferentes, e e o que torna o accessFn
// de texto distinguivel do accessFn de instante. Por ordem cronologica o
// deadline e 20/09 < 01/10 < 15/11; ordenando as MESMAS datas como texto
// "dd/mm/aaaa" o resultado e 01/10 < 15/11 < 20/09 — outra ordem, e nao a
// inversa da certa. Com duas datas o teste seria cego: o `getAutoSortDir` do
// TanStack sobe (`asc`) para valor de texto e desce (`desc`) para numero, entao
// trocar o accessor tambem inverte a direcao e os dois erros se cancelam. Sao
// tres linhas que quebram o cancelamento.
const SETEMBRO = makeItem({ id: "i-setembro", title: "Cadeira de escritório", bidDeadline: new Date("2026-09-20T12:00:00Z") });
const OUTUBRO = makeItem({ id: "i-outubro", title: "Ventilador de teto", bidDeadline: new Date("2026-10-01T12:00:00Z") });
const NOVEMBRO = makeItem({ id: "i-novembro", title: "Fogão industrial", bidDeadline: new Date("2026-11-15T12:00:00Z") });
const POR_PRAZO = [NOVEMBRO, SETEMBRO, OUTUBRO];

// ponytail: o instante exato que o `item-form` produz quando o vendedor digita
// "30/09 22:00" no `datetime-local`: o `new Date(...)` local de um servidor em
// UTC vira `2026-10-01T01:00Z`. E o unico tipo de instante em que o fuso do
// processo muda o DIA visivel — 01:00 UTC ainda e 30/09 as 22h em Sao Paulo, e
// 01/10 as 22h em qualquer fuso a leste. Por isso o prazo deste item nao serve
// aos outros testes.
const PRAZO_DE_FRONTEIRA = new Date("2026-10-01T01:00:00Z");

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

// ponytail: o `cleanup()` no fim e o que permite dois renders no mesmo `it`.
// Sem ele as duas tabelas ficariam no `document` e `unicaLinha()` veria quatro
// celulas (o `afterEach` do `dom-render` so roda no fim do teste).
function lerPrazo(item: Item): string {
  render(<ItemsList items={[item]} current="all" />);
  const texto = within(unicaLinha()).getByText(/\d{2}\/\d{2}\/\d{4}/).textContent ?? "";
  cleanup();
  return texto;
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

    // ponytail: 123456 centavos. O ponto e a virgula so saem do `formatReais`: o
    // numero cru renderizaria "123456". A busca e por texto, e nao por indice de
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
    const fusoOriginal = process.env.TZ;
    const item = makeItem({ id: "i-fuso", bidDeadline: PRAZO_DE_FRONTEIRA });
    try {
      process.env.TZ = "UTC";
      const comServidorUtc = lerPrazo(item);
      process.env.TZ = "America/Sao_Paulo";
      const comServidorSaoPaulo = lerPrazo(item);

      expect(comServidorUtc).toBe("30/09/2026");
      expect(comServidorSaoPaulo).toBe("30/09/2026");
    } finally {
      if (fusoOriginal === undefined) delete process.env.TZ;
      else process.env.TZ = fusoOriginal;
    }
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

  // ponytail: o mesmo formato do teste do lance minimo, e pela mesma razao: o
  // `accessorFn` e ao mesmo tempo o valor que ordena e o que a busca casa, e so o
  // resultado da ordenacao diz qual dos dois ele entrega. As tres datas
  // sao de meses diferentes de proposito (ver `POR_PRAZO`): ordenadas como texto
  // "dd/mm/aaaa" elas trocam de lugar, entao um accessor de texto nao passa
  // verde aqui. A primeira direcao e descendente porque o `getAutoSortDir` do
  // TanStack desce primeiro quando o valor de acesso nao e string.
  it("ordena por deadline em ordem cronologica, e nao de texto", () => {
    render(<ItemsList items={POR_PRAZO} current="all" />);

    fireEvent.click(botaoDeOrdenacao("Deadline"));
    expect(titulos()).toEqual(["Fogão industrial", "Ventilador de teto", "Cadeira de escritório"]);

    fireEvent.click(botaoDeOrdenacao("Deadline"));
    expect(titulos()).toEqual(["Cadeira de escritório", "Ventilador de teto", "Fogão industrial"]);
  });

  // ponytail: o status nao tem "ordem certa" de ciclo de vida, entao o teste nao
  // diz qual e a ordem desejada — diz qual e a ordem que a coluna entrega hoje: a
  // alfabetica sobre o rotulo pt-BR que o usuario le na celula
  // ("Cancelado" < "Em leilao" < "Rascunho"). E o que importa aqui: e a MESMA
  // string que o `accessorFn` entrega para a busca, entao um accessor que volte
  // para o enum ingles troca a ordem E quebra a busca — os dois lados do
  // contrato caem juntos, e um teste de ordenacao que so afaste o enum
  // diferente deixaria o segundo cego.
  it("ordena por status pelo rotulo pt-BR que aparece na celula", () => {
    render(<ItemsList items={POR_STATUS} current="all" />);

    fireEvent.click(botaoDeOrdenacao("Status"));
    expect(titulos()).toEqual(["Impressora jato", "Teclado mecânico", "Cadeira gamer"]);

    fireEvent.click(botaoDeOrdenacao("Status"));
    expect(titulos()).toEqual(["Cadeira gamer", "Teclado mecânico", "Impressora jato"]);
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

    // ponytail: um menu vazio e um beco sem saida: melhor nao ter gatilho.
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

describe("ItemsList — a busca global acha o que esta escrito na celula", () => {
  // ponytail: "Em leilao" e o texto do badge na linha do `ATIVO`, e nao um valor
  // interno: e o que o usuario le na tela e digita. Com o `accessorFn` no enum
  // ingles a coluna entregava "active" para a busca, o termo nao casava com nada
  // e a tabela respondia "Nenhum item encontrado." para uma busca que estava
  // escrita exatamente como a tela. E o texto da celula que fixa essa identidade
  // entre o que se ve e o que se busca: o badge e o `accessorFn` sao o mesmo texto.
  it("acha o item pelo rotulo de status que esta na tela", async () => {
    vi.useFakeTimers();
    try {
      render(<ItemsList items={POR_STATUS} current="all" />);
      fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "Em leilão" } });
      await avancarRelogio(400);

      expect(titulos()).toEqual(["Teclado mecânico"]);
    } finally {
      vi.useRealTimers();
    }
  });

  // ponytail: o mesmo termo sem o acento, que e como o usuario digita num
  // teclado sem cedilha. O `contemSemAcento` do `DataTable` cuida da
  // normalizacao; aqui o que importa e que o rotulo seja mesmo "Em leilao" e nao
  // "active" — um `accessorFn` em ingles reprova as duas formas.
  it("acha o mesmo status sem o acento, como o usuario digita", async () => {
    vi.useFakeTimers();
    try {
      render(<ItemsList items={POR_STATUS} current="all" />);
      fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "leilao" } });
      await avancarRelogio(400);

      expect(titulos()).toEqual(["Teclado mecânico"]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("ItemsList — modo servidor", () => {
  it("conta o total do servidor no rodapé, e nao o tamanho da página", () => {
    render(<ItemsList items={[BICICLETA, CONSOLE]} current="all" totalCount={100} pageIndex={2} />);

    // ponytail: a janela e a da pagina 2 com 10 por pagina (o padrao do DataTable): o que
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

  // ponytail: o Select de tamanho e um controle do pai, nao do `DataTable`, no
  // modo servidor — e o `tratarPagina` so avisa o pai quando o `onPageSizeChange`
  // chega ate ele. Sem o repasse, o `onPageSizeChange?.()` era `undefined`: o
  // usuario escolhia 50, o gatilho continuava marcando 10 e nenhum callback
  // saia. A escolha silenciosamente voltava ao normal. A assercao e sobre o
  // callback (o que o pai consegue fazer) e nao sobre o gatilho, que so muda
  // depois que o pai devolver a prop nova.
  it("avisa o pai quando o tamanho de pagina muda pelo Select", () => {
    const onPageSizeChange = vi.fn();
    render(
      <ItemsList
        items={[BICICLETA, CONSOLE]}
        current="all"
        totalCount={100}
        pageIndex={0}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Linhas por página" }));
    const opcao = screen.getByRole("option", { name: "50" });
    fireEvent.pointerDown(opcao);
    fireEvent.click(opcao);

    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  // ponytail: a outra metade do repasse — `pageSize` do pai para o `DataTable`.
  // Sem ela o `pageSize` viraria letra morta no contrato: o pai ajustaria a
  // pagina e a tabela fingiria obedecer, com o rodape contando sempre pela
  // janela de 10 do default.
  it("usa o pageSize do pai como tamanho em uso", () => {
    render(<ItemsList items={[BICICLETA, CONSOLE]} current="all" totalCount={100} pageIndex={0} pageSize={50} />);

    expect(screen.getByRole("combobox", { name: "Linhas por página" }).textContent).toContain("50");
  });
});
