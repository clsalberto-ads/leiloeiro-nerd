import { describe, expect, it } from "vitest";
import { STATUS_LABELS, type ItemOrderBy, type ItemStatus } from "@/domain/repositories/item-repository";
import {
  DASHBOARD_ITEMS_PATH,
  sortColumnByOrder,
  toDashboardFilter,
  buildDashboardHref,
  parseDashboardParams,
  sortOrderByColumn,
  lastPage,
  DEFAULT_TABLE_VIEW,
  type DashboardTableView,
} from "./dashboard-table-state";

// ponytail: o leitor e testado pelo `URLSearchParams` do Node, e nao por um
// objeto de `searchParams` montado a mao. Isso nao e detalhe de teste: e a prova
// de que a MESMA funcao de busca serve para o servidor (que recebe o objeto do
// Next) e para o cliente (que so tem `URLSearchParams`) — a promessa do modulo
// de que existe uma porta so. Um duble de `{ page: "2" }` passaria igual e nao
// provaria nada.
function le(query: string): DashboardTableView {
  const params = new URLSearchParams(query);
  return parseDashboardParams((name) => params.get(name));
}

function withView(mudanca: Partial<DashboardTableView>): DashboardTableView {
  return { ...DEFAULT_TABLE_VIEW, ...mudanca };
}

function queryOf(view: DashboardTableView): URLSearchParams {
  return new URLSearchParams(buildDashboardHref(view).split("?")[1] ?? "");
}

describe("dashboard-table-state — a URL vazia é a tela padrão", () => {
  it("sem parâmetro nenhum a vista é a padrão", () => {
    expect(le("")).toEqual(DEFAULT_TABLE_VIEW);
  });

  // ponytail: e o teste que fixa a promessa de "copiar e colar o link". A tela sem
  // filtro nenhum e a que a pessoa ja conhecia: se a URL dela carregasse
  // `?orderBy=createdAt&direction=desc&page=1&pageSize=10`, todo link colado
  // seria quatro vezes maior que o preciso e o botao "voltar" teria quatro
  // estados a mais para desfazer.
  it("a vista padrão não escreve nada na URL", () => {
    expect(buildDashboardHref(DEFAULT_TABLE_VIEW)).toBe(DASHBOARD_ITEMS_PATH);
  });
});

describe("dashboard-table-state — o que a URL omite", () => {
  // ponytail: as quatro combinacoes de (ordem, direcao) da coluna padrao. E a
  // tabela que fecha a discussao de "`direction` ausente = asc" vs "a tela =
  // desc": so a coluna padrao tem a vista padrao, e so dela se pode omitir a
  // ordenacao. Um
  // `?direction=asc` sem `orderBy` e a tela "dos mais antigos para os mais novos",
  // que ninguem alcanca por clique (a coluna `createdAt` nao tem cabecalho) e que
  // por isso precisa sobreviver a volta pela URL.
  it.each([
    ["createdAt desc", "a tela padrão, sem parâmetro de ordenação", ""],
    ["createdAt asc", "a coluna padrão ao contrário", "?direction=asc"],
    ["title asc", "outra coluna, ordem natural", "?orderBy=title"],
    ["title desc", "outra coluna, invertida", "?orderBy=title&direction=desc"],
  ])("%s se escreve como %s", (_case, _description, expected) => {
    const [orderBy, direction] = _case.split(" ") as [DashboardTableView["orderBy"], DashboardTableView["direction"]];
    expect(buildDashboardHref(withView({ orderBy, direction }))).toBe(`${DASHBOARD_ITEMS_PATH}${expected}`);
  });

  it("o que se lê sem direction em outra coluna é a ordem natural dela", () => {
    expect(le("?orderBy=title")).toEqual(withView({ orderBy: "title", direction: "asc" }));
  });

  it("o que se lê sem orderBy é a coluna padrão com a direção escrita", () => {
    // ponytail: e o par que o `toDashboardFilter` precisa escrever sempre. Se
    // `orderBy` ficasse `undefined` para a vista padrão, o `ItemListFilter`
    // receberia so `direction: "asc"` e o default do dominio (createdAt DESC)
    // engoliria o asc — a tela mostraria o contrario do que a URL pedia.
    expect(le("?direction=asc")).toEqual(withView({ orderBy: "createdAt", direction: "asc" }));
  });

  it("o que se lê sem nenhum parâmetro de ordenação é a vista padrão", () => {
    expect(le("?q=abc").orderBy).toBe("createdAt");
    expect(le("?q=abc").direction).toBe("desc");
  });
});

describe("dashboard-table-state — a ordem dos parâmetros na URL", () => {
  // ponytail: a string inteira e a assercao, e nao o `URLSearchParams` (que
  // ordenaria as chaves e esconderia a ordem). Duas vistas iguais precisam dar a
  // MESMA string, senao a mesma tela tem dois enderecos e o historico do navegador
  // nao sabe qual desfazer.
  it("manda busca, aba, ordenação, página e tamanho sempre nesta ordem", () => {
    const href = buildDashboardHref({
      q: "console",
      status: "active",
      orderBy: "minInitialBid",
      direction: "desc",
      page: 3,
      pageSize: 50,
    });

    expect(href).toBe(
      `${DASHBOARD_ITEMS_PATH}?q=console&status=active&orderBy=minInitialBid&direction=desc&page=3&pageSize=50`,
    );
  });

  it("pula o que é o padrão e mantém o resto na mesma ordem", () => {
    const href = buildDashboardHref(withView({ q: "x", status: "draft", page: 2, pageSize: 20 }));

    expect(href).toBe(`${DASHBOARD_ITEMS_PATH}?q=x&status=draft&page=2&pageSize=20`);
  });
});

describe("dashboard-table-state — o termo de busca", () => {
  it("apara o espaço das pontas na leitura", () => {
    expect(le("?q=%20%20console%20%20").q).toBe("console");
  });

  it("apara o espaço das pontas na escrita", () => {
    expect(buildDashboardHref(withView({ q: "  console  " }))).toBe(`${DASHBOARD_ITEMS_PATH}?q=console`);
  });

  it("escreve o espaço como %20, e não como +", () => {
    // ponytail: `+` em query string e lido como espaco por um decodificador e
    // como "mais" por outro. `encodeURIComponent` escreve `%20`, que todo mundo
    // le como espaco. Um `URLSearchParams` aqui passaria em varios testes e
    // falharia em producao, num proxy ou num loggedor.
    expect(buildDashboardHref(withView({ q: "jogo de mesa" }))).toBe(`${DASHBOARD_ITEMS_PATH}?q=jogo%20de%20mesa`);
  });

  // ponytail: `%` e `_` sao os dois caracteres que o `LIKE` trata como curinga, e
  // os dois atravessam o encoding sem virar nada. Eles nao precisam de escape
  // especial no Postgres (o padrao e `ESCAPE '\'`, e o drizzle parametriza), mas
  // o teste existe para prender o `%20`/`%25` na mesma frase: um `decodeURI` no
  // caminho errado viraria "100%".
  it.each([["100% nicel"], ["snake_case"], ["a&b=c"], ["50% off #1"], ["acentuação"]])( 
    "o termo %s volta igual",
    (termo) => {
      const view = withView({ q: termo });
      expect(le(queryOf(view).toString()).q).toBe(termo);
    },
  );

  // ponytail: o `q` nao tem teto, e este e o teste que trava essa decisao. Cortar
  // o termo no meio mudaria o CONJUNTO que a busca devolve (o item com o titulo
  // inteiro deixaria de casar), que e a mesma mentira do `total` contado antes do
  // filtro. Um teto aqui viraria um `slice` silencioso no meio do `buildDashboardHref`.
  it("não trunca um termo longo: a URL é o que o usuario escreveu", () => {
    const termo = "c".repeat(300);
    expect(le(queryOf(withView({ q: termo })).toString()).q).toBe(termo);
  });

  it("trata espaço em branco como ausência de busca", () => {
    expect(le("?q=%20%20").q).toBe("");
    expect(buildDashboardHref(withView({ q: "   " }))).toBe(DASHBOARD_ITEMS_PATH);
  });
});

describe("dashboard-table-state — número de URL que não é número de tela", () => {
  // ponytail: a tela so produz inteiro — o `Select` oferece 5/10/20/50 e o
  // "próxima" soma 1. Entao fracionario, `NaN`, `Infinity` e notacao cientifica
  // so chegam de mao humana na barra de endereco, e o que a tela deveria mostrar
  // depois de um erro de digitacao e a tela normal (nem um 500, nem um `LIMIT must
  // not have a decimal` do Postgres).
  it.each([
    ["abc"],
    ["1.5"],
    ["-"],
    ["1e999"],
    ["Infinity"],
    ["NaN"],
    ["0x10"],
    [""],
  ])("page=%s volta para 1", (bruto) => {
    expect(le(`?page=${encodeURIComponent(bruto)}`).page).toBe(1);
  });

  it.each([
    ["abc"],
    ["10.7"],
    ["1e999"],
    [""],
  ])("pageSize=%s volta para 10", (bruto) => {
    expect(le(`?pageSize=${encodeURIComponent(bruto)}`).pageSize).toBe(10);
  });

  // ponytail: o piso 1 tem um caso de verdade (`0`) e o negativo e caso do filtro de
  // digitos (`-5` nem chega a ser numero). Os dois no mesmo teste porque a fronteira
  // importa: se o `DIGITS_ONLY` afrouxar, o `-5` volta a ser numero e quem segura o
  // piso passa a ser o `Math.max(1, ...)`.
  it.each([
    ["0", 1],
    ["1", 1],
    ["-5", 10],
  ])("pageSize=%s fica entre 1 e o limite", (bruto, expected) => {
    expect(le(`?pageSize=${bruto}`).pageSize).toBe(expected);
  });

  // ponytail: o teto do `pageSize` e o que impede `?pageSize=99999` de ser uma
  // instrucao legitima de renderizar 99.999 linhas. E o piso 1 e o outro extremo:
  // `limit <= 0` some no `listSellerItems` (o que e "todos os itens") e e divisao
  // por zero no rodape do `DataTable`. Um `pageSize=30` que nao esta na lista do
  // `Select` NAO e arredondado: 30 e uma escolha legitima e trocar 30 por 50 em
  // silencio seria pior do que respeitar.
  it.each([
    ["99999", 100],
    ["1000", 100],
    ["100", 100],
    ["30", 30],
  ])("pageSize=%s respeita o teto de 100 sem arredondar", (bruto, expected) => {
    expect(le(`?pageSize=${bruto}`).pageSize).toBe(expected);
  });

  it("page nao tem teto: link colado de uma lista que encolheu e inofensivo", () => {
    // ponytail: um `page=99999` devolve um `OFFSET` vazio, e quem trata disso e a
    // pagina, com o `redirect` para a ultima pagina (ver `page.test.tsx`). Um teto
    // aqui seria mais um numero para lembrar sem impedir nada.
    expect(le("?page=99999").page).toBe(99999);
  });

  it("page=1 é a primeira página, e page=0 não existe", () => {
    expect(le("?page=1").page).toBe(1);
    expect(le("?page=0").page).toBe(1);
  });
});

describe("dashboard-table-state — vocabulário que não é o do enum", () => {
  it.each([
    ["orderBy", "createdAtX"],
    ["orderBy", "title;drop table items"],
    ["orderBy", ""],
    ["orderBy", "TITLE"],
  ])("%s=%s cai no padrão em vez de passar adiante", (parametro, value) => {
    // ponytail: o padrao e a tela sem filtro, e nao um 404 nem "ignorar". O 404
    // transforma um erro de digitacao em "este site nao existe" para uma tela que
    // existe e funciona; e "ignorar" e impossivel porque quem ignoraria e o
    // dominio, que nao sabe o que a URL queria. Um `?orderBy=;drop` que chegasse
    // ao `listSellerItems` viraria nome de coluna no SQL.
    expect(le(`?${parametro}=${encodeURIComponent(value)}`).orderBy).toBe("createdAt");
  });

  // ponytail: o padrao da direcao depende de ter havido `orderBy`, entao sao DOIS
  // testes e nao um. `?orderBy=title&direction=xxx` e "outra coluna com direcao
  // invalida" -> a ordem natural dela (asc). `?direction=xxx` sem coluna e a tela
  // padrao (desc), porque sem `orderBy` nao existe "ordem natural de coluna" para
  // completar. Tratar os dois com o mesmo padrao quebraria o round-trip de
  // `?direction=asc`: ele seria lido de volta como a tela padrao, e o "mais
  // antigos primeiro" viraria um loop de normalizacao entre dois estados.
  it.each([["ASC"], ["up"], ["a sc"], [""], ["asc "]])(
    "direction=%s sem orderBy cai na tela padrão",
    (value) => {
      expect(le(`?direction=${encodeURIComponent(value)}`).direction).toBe("desc");
    },
  );

  it.each([["ASC"], ["up"], [""], ["asc "]])(
    "direction=%s com orderBy cai na ordem natural da coluna",
    (value) => {
      expect(le(`?orderBy=title&direction=${encodeURIComponent(value)}`)).toEqual(
        withView({ orderBy: "title", direction: "asc" }),
      );
    },
  );

  it.each([["archived"], ["DRAFT"], ["active "], ["0"]])("status=%s vira sem filtro", (value) => {
    expect(le(`?status=${encodeURIComponent(value)}`).status).toBeNull();
  });

  // ponytail: o leitor aceita TODOS os status do `STATUS_LABELS`, inclusive os que
  // nao tem aba. A lista de aceitos e derivada do mapa, e nao escrita a mao, para
  // nao poder divergir do vocabulario: um status novo entra no enum e no mapa e a
  // URL passa a filtra-lo sem ninguem editar este arquivo. A lista escrita a mao
  // viraria um status que a tela nao consegue filtrar.
  it("todo status do vocabulário é filtrável pela URL", () => {
    for (const status of Object.keys(STATUS_LABELS) as ItemStatus[]) {
      expect(le(`?status=${status}`).status).toBe(status);
    }
  });
});

describe("dashboard-table-state — ida e volta", () => {
  // ponytail: a propriedade que fecha o arquivo. Uma vista lida da URL, reescrita
  // e relida tem que dar a MESMA vista, e o mesmo href. E o que garante que
  // "voltar/avancar", "copiar o link" e o "f5" nao mudem a tela — e o que impede
  // uma forma de URLNormalization de ping-pong entre dois estados (que e
  // mostraria a tela piscando a cada navegacao).
  it.each([
    DEFAULT_TABLE_VIEW,
    withView({ q: "console retrô" }),
    withView({ status: "closed" }),
    withView({ orderBy: "title", direction: "asc" }),
    withView({ orderBy: "minInitialBid", direction: "desc" }),
    withView({ orderBy: "bidDeadline", direction: "asc" }),
    withView({ page: 7, pageSize: 50 }),
    withView({ q: "100% _a_", status: "paid", orderBy: "title", direction: "desc", page: 2, pageSize: 20 }),
  ])("a vista %# volta igual depois de passar pela URL", (view) => {
    const href = buildDashboardHref(view);
    expect(buildDashboardHref(le(queryOf(view).toString()))).toBe(href);
  });

  it("o parâmetro repetido vale o primeiro, como no URLSearchParams", () => {
    expect(le("?page=2&page=9").page).toBe(2);
  });
});

describe("dashboard-table-state — a vista virada em filtro do domínio", () => {
  it("sempre escreve orderBy e direction, mesmo na vista padrão", () => {
    // ponytail: e o que impede a armadilha do `createdAt`. Com `orderBy`
    // opcional, a vista "createdAt asc" viraria `{ direction: "asc" }` e o
    // default do repositorio (createdAt DESC) engoliria o asc.
    expect(toDashboardFilter(withView({ direction: "asc" }))).toEqual({
      orderBy: "createdAt",
      direction: "asc",
      limit: 10,
      offset: 0,
    });
  });

  it("converte página e tamanho em limit e offset", () => {
    expect(toDashboardFilter(withView({ page: 3, pageSize: 20 }))).toMatchObject({
      limit: 20,
      offset: 40,
    });
  });

  it("leva o termo e o status só quando existem", () => {
    expect(toDashboardFilter(withView({ q: "console", status: "draft" }))).toEqual({
      q: "console",
      status: "draft",
      orderBy: "createdAt",
      direction: "desc",
      limit: 10,
      offset: 0,
    });
    // ponytail: a ausencia e chave faltando, e nao `q: ""` nem `status: undefined`.
    // O `listSellerItems` trata os dois como ausencia, mas um `status: undefined`
    // no objeto atravessa o drizzle como parametro, e o que a tela mostra e o que
    // o filtro tem.
    expect(Object.keys(toDashboardFilter(DEFAULT_TABLE_VIEW)).sort()).toEqual([
      "direction",
      "limit",
      "offset",
      "orderBy",
    ]);
  });
});

describe("dashboard-table-state — a ponte entre a coluna da tela e a coluna do servidor", () => {
  // ponytail: os dois sentidos do mesmo par. O erro que o `tsc` NAO pega e um id
  // de coluna trocado aqui: o valor continua sendo um `ItemOrderBy` valido, a
  // seta aparece, a URL muda, e so quem sabe o mapeamento percebe que a tabela
  // voltou na ordem antiga. E por isso que o `items-list.dom.test.tsx` clica em
  // CADA cabecalho ordenavel e ve a `orderBy` que sai.
  //
  // O `it.each<[...]>` declara o tipo de cada coluna da tabela, e a anotacao nao e
  // decorativa: sem ela o `it.each` widenaria as duas celulas para `string`, e o
  // `sortColumnByOrder(orderBy)` viraria um `as` — que e o que apagaria deste
  // teste a unica verificacao que o compilador faz sobre o par (o `orderBy`
  // precisa ser membro da union para o segundo sentido compilar).
  it.each<[string, ItemOrderBy]>([
    ["title", "title"],
    ["minInitialBid", "minInitialBid"],
    ["bidDeadline", "bidDeadline"],
  ])("a coluna %s volta para %s", (column, orderBy) => {
    expect(sortOrderByColumn(column)).toBe(orderBy);
    expect(sortColumnByOrder(orderBy)).toBe(column);
  });

  it("createdAt é o padrão e não tem coluna na tela", () => {
    expect(sortColumnByOrder("createdAt")).toBeNull();
  });

  it("coluna que não está no contrato não vira orderBy", () => {
    expect(sortOrderByColumn("status")).toBeUndefined();
    expect(sortOrderByColumn("actions")).toBeUndefined();
  });
});

describe("dashboard-table-state — a última página", () => {
  it.each([
    [0, 10, 1],
    [1, 10, 1],
    [10, 10, 1],
    [11, 10, 2],
    [100, 10, 10],
    [101, 10, 11],
    [100, 50, 2],
  ])("de %i itens em paginas de %i a ultima é %i", (total, pageSize, expected) => {
    expect(lastPage(total, pageSize)).toBe(expected);
  });

  // ponytail: o piso 1 e o que impede o laco. Com `total = 0` nao existe ultima
  // pagina, e `buildDashboardHref({ page: 0 })` devolveria uma URL que a leitura troca
  // por `page=1` — o `redirect` apontaria para a propria URL de origem e o
  // navegador ficaria redirecionando para sempre. Uma tela vazia e a PRIMEIRA
  // pagina vazia.
  it("sem itens a última página é a primeira, e não a página zero", () => {
    expect(lastPage(0, 10)).toBe(1);
    expect(buildDashboardHref(withView({ page: lastPage(0, 10) }))).toBe(DASHBOARD_ITEMS_PATH);
  });
});

// ponytail: este `describe` existe por causa de uma frase no `ponytail:` da
// `encodeQuery` em `dashboard-table-state.ts`, que afirmava `ler(emitir(v)) === emitir(v)`
// para TODA vista. A equacao e FALSA: com `q` suja, ler volta o valor aparado, que
// nao e a `DashboardTableView` original. A propriedade verdadeira e o ponto fixo do
// HREF — `buildDashboardHref(ler(buildDashboardHref(v))) === buildDashboardHref(v)` — e ela vale porque
// a NORMALIZACAO e da escrita: o `buildDashboardHref` apara o `q` antes de codificar.
//
// A frase vivia num comentario, entao o `tsc` nao a via e nenhum teste a negava.
// E o mesmo defeito que a vitrine corrigiu no modulo irmao; os dois arquivos
// espelham o mesmo padrao, entao o defeito via junto.
describe("dashboard-table-state — o ponto fixo do href, com q suja", () => {
  const vistas: DashboardTableView[] = [
    withView({ q: "", orderBy: "createdAt", direction: "desc", page: 1, pageSize: 10 }),
    withView({ q: "  console  " }),
    withView({ q: "   " }),
    withView({ q: "  console  ", orderBy: "title", direction: "asc" }),
    withView({ q: "jogo raro", status: "active", page: 3, pageSize: 50 }),
    withView({ q: "  a & b = c  ", orderBy: "minInitialBid", direction: "asc", pageSize: 20 }),
  ];

  for (const view of vistas) {
    it(`reescrever o endereco lido devolve o mesmo endereco: ${JSON.stringify(view.q)} + ${view.orderBy}`, () => {
      const href = buildDashboardHref(view);
      expect(buildDashboardHref(le(`?${queryOf(view)}`))).toBe(href);
    });
  }

  // ponytail: e a evidencia de que a equacao antiga era falsa, nao um teste de
  // borda. Com `q` suja, a Vista lida e diferente da Vista emitida — e isso e
  // esperado, porque a escrita normaliza. O que nao pode diferir e o ENDERECO.
  it("com q suja a Vista lida difere da emitida, mas o endereço não", () => {
    const emitida = withView({ q: "  console  ", orderBy: "title", direction: "asc" });
    const lida = le(`?${queryOf(emitida)}`);
    expect(lida.q).not.toBe(emitida.q);
    expect(lida.q).toBe("console");
    expect(buildDashboardHref(lida)).toBe(buildDashboardHref(emitida));
  });
});
