import { describe, expect, it } from "vitest";
import { ROTULO_STATUS, type ItemOrderBy, type ItemStatus } from "@/domain/repositories/item-repository";
import {
  CAMINHO_DA_LISTA,
  colunaDaOrdenacao,
  filtroDaVista,
  hrefDaVista,
  interpretarParametros,
  ordenacaoDaColuna,
  ultimaPagina,
  VISTA_PADRAO,
  type VistaDaTabela,
} from "./estado-da-tabela";

// ponytail: o leitor e testado pelo `URLSearchParams` do Node, e nao por um
// objeto de `searchParams` montado a mao. Isso nao e detalhe de teste: e a prova
// de que a MESMA funcao de busca serve para o servidor (que recebe o objeto do
// Next) e para o cliente (que so tem `URLSearchParams`) — a promessa do modulo
// de que existe uma porta so. Um duble de `{ page: "2" }` passaria igual e nao
// provaria nada.
function le(consulta: string): VistaDaTabela {
  const params = new URLSearchParams(consulta);
  return interpretarParametros((nome) => params.get(nome));
}

function com(mudanca: Partial<VistaDaTabela>): VistaDaTabela {
  return { ...VISTA_PADRAO, ...mudanca };
}

function consultaDe(vista: VistaDaTabela): URLSearchParams {
  return new URLSearchParams(hrefDaVista(vista).split("?")[1] ?? "");
}

describe("estado-da-tabela — a URL vazia é a tela padrão", () => {
  it("sem parâmetro nenhum a vista é a padrão", () => {
    expect(le("")).toEqual(VISTA_PADRAO);
  });

  // ponytail: e o teste que fixa a promessa de "copiar e colar o link". A tela sem
  // filtro nenhum e a que a pessoa ja conhecia: se a URL dela carregasse
  // `?orderBy=createdAt&direction=desc&page=1&pageSize=10`, todo link colado
  // seria quatro vezes maior que o preciso e o botao "voltar" teria quatro
  // estados a mais para desfazer.
  it("a vista padrão não escreve nada na URL", () => {
    expect(hrefDaVista(VISTA_PADRAO)).toBe(CAMINHO_DA_LISTA);
  });
});

describe("estado-da-tabela — o que a URL omite", () => {
  // ponytail: as quatro combinacoes de (ordem, direcao) da coluna padrao. E a
  // tabela que fecha a discussao de "`direction` ausente = asc" vs "a tela =
  // desc": so a coluna padrao tem a vista padrao e so ela pode ser省略. Um
  // `?direction=asc` sem `orderBy` e a tela "dos mais antigos para os mais novos",
  // que ninguem alcanca por clique (a coluna `createdAt` nao tem cabecalho) e que
  // por isso precisa sobreviver a volta pela URL.
  it.each([
    ["createdAt desc", "a tela padrão, sem parâmetro de ordenação", ""],
    ["createdAt asc", "a coluna padrão ao contrário", "?direction=asc"],
    ["title asc", "outra coluna, ordem natural", "?orderBy=title"],
    ["title desc", "outra coluna, invertida", "?orderBy=title&direction=desc"],
  ])("%s se escreve como %s", (_caso, _descricao, esperado) => {
    const [orderBy, direction] = _caso.split(" ") as [VistaDaTabela["orderBy"], VistaDaTabela["direction"]];
    expect(hrefDaVista(com({ orderBy, direction }))).toBe(`${CAMINHO_DA_LISTA}${esperado}`);
  });

  it("o que se lê sem direction em outra coluna é a ordem natural dela", () => {
    expect(le("?orderBy=title")).toEqual(com({ orderBy: "title", direction: "asc" }));
  });

  it("o que se lê sem orderBy é a coluna padrão com a direção escrita", () => {
    // ponytail: e o par que o `filtroDaVista` precisa escrever sempre. Se
    // `orderBy` ficasse `undefined` para a vista padrão, o `ItemListFilter`
    // receberia so `direction: "asc"` e o default do dominio (createdAt DESC)
    // engoliria o asc — a tela mostraria o contrario do que a URL pedia.
    expect(le("?direction=asc")).toEqual(com({ orderBy: "createdAt", direction: "asc" }));
  });

  it("o que se lê sem nenhum parâmetro de ordenação é a vista padrão", () => {
    expect(le("?q=abc").orderBy).toBe("createdAt");
    expect(le("?q=abc").direction).toBe("desc");
  });
});

describe("estado-da-tabela — a ordem dos parâmetros na URL", () => {
  // ponytail: a string inteira e a assercao, e nao o `URLSearchParams` (que
  // ordenaria as chaves e esconderia a ordem). Duas vistas iguais precisam dar a
  // MESMA string, senao a mesma tela tem dois enderecos e o historico do navegador
  // nao sabe qual desfazer.
  it("manda busca, aba, ordenação, página e tamanho sempre nesta ordem", () => {
    const href = hrefDaVista({
      q: "console",
      status: "active",
      orderBy: "minInitialBid",
      direction: "desc",
      page: 3,
      pageSize: 50,
    });

    expect(href).toBe(
      `${CAMINHO_DA_LISTA}?q=console&status=active&orderBy=minInitialBid&direction=desc&page=3&pageSize=50`,
    );
  });

  it("pula o que é o padrão e mantém o resto na mesma ordem", () => {
    const href = hrefDaVista(com({ q: "x", status: "draft", page: 2, pageSize: 20 }));

    expect(href).toBe(`${CAMINHO_DA_LISTA}?q=x&status=draft&page=2&pageSize=20`);
  });
});

describe("estado-da-tabela — o termo de busca", () => {
  it("apara o espaço das pontas na leitura", () => {
    expect(le("?q=%20%20console%20%20").q).toBe("console");
  });

  it("apara o espaço das pontas na escrita", () => {
    expect(hrefDaVista(com({ q: "  console  " }))).toBe(`${CAMINHO_DA_LISTA}?q=console`);
  });

  it("escreve o espaço como %20, e não como +", () => {
    // ponytail: `+` em query string e lido como espaco por um decodificador e
    // como "mais" por outro. `encodeURIComponent` escreve `%20`, que todo mundo
    // le como espaco. Um `URLSearchParams` aqui passaria em varios testes e
    // falharia em producao, num proxy ou num loggedor.
    expect(hrefDaVista(com({ q: "jogo de mesa" }))).toBe(`${CAMINHO_DA_LISTA}?q=jogo%20de%20mesa`);
  });

  // ponytail: `%` e `_` sao os dois caracteres que o `LIKE` trata como curinga, e
  // os dois atravessam o encoding sem virar nada. Eles nao precisam de escape
  // especial no Postgres (o padrao e `ESCAPE '\'`, e o drizzle parametriza), mas
  // o teste existe para prender o `%20`/`%25` na mesma frase: um `decodeURI` no
  // caminho errado viraria "100%".
  it.each([["100% nicel"], ["snake_case"], ["a&b=c"], ["50% off #1"], ["acentuação"]])( 
    "o termo %s volta igual",
    (termo) => {
      const vista = com({ q: termo });
      expect(le(consultaDe(vista).toString()).q).toBe(termo);
    },
  );

  // ponytail: o `q` nao tem teto, e este e o teste que trava essa decisao. Cortar
  // o termo no meio mudaria o CONJUNTO que a busca devolve (o item com o titulo
  // inteiro deixaria de casar), que e a mesma mentira do `total` contado antes do
  // filtro. Um teto aqui viraria um `slice` silencioso no meio do `hrefDaVista`.
  it("não trunca um termo longo: a URL é o que o usuario escreveu", () => {
    const termo = "c".repeat(300);
    expect(le(consultaDe(com({ q: termo })).toString()).q).toBe(termo);
  });

  it("trata espaço em branco como ausência de busca", () => {
    expect(le("?q=%20%20").q).toBe("");
    expect(hrefDaVista(com({ q: "   " }))).toBe(CAMINHO_DA_LISTA);
  });
});

describe("estado-da-tabela — número de URL que não é número de tela", () => {
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
  // importa: se o `SO_DIGITOS` afrouxar, o `-5` volta a ser numero e quem segura o
  // piso passa a ser o `Math.max(1, ...)`.
  it.each([
    ["0", 1],
    ["1", 1],
    ["-5", 10],
  ])("pageSize=%s fica entre 1 e o limite", (bruto, esperado) => {
    expect(le(`?pageSize=${bruto}`).pageSize).toBe(esperado);
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
  ])("pageSize=%s respeita o teto de 100 sem arredondar", (bruto, esperado) => {
    expect(le(`?pageSize=${bruto}`).pageSize).toBe(esperado);
  });

  it("page nao tem teto: link colado de uma lista que encolheu e inofensivo", () => {
    // ponytail: um `page=99999` devolve um `OFFSET` vazio, e quem trata disso e a
    // pagina, com o `redirect` para a ultima pagina (ver `page.test.ts`). Um teto
    // aqui seria mais um numero para lembrar sem impedir nada.
    expect(le("?page=99999").page).toBe(99999);
  });

  it("page=1 é a primeira página, e page=0 não existe", () => {
    expect(le("?page=1").page).toBe(1);
    expect(le("?page=0").page).toBe(1);
  });
});

describe("estado-da-tabela — vocabulário que não é o do enum", () => {
  it.each([
    ["orderBy", "createdAtX"],
    ["orderBy", "title;drop table items"],
    ["orderBy", ""],
    ["orderBy", "TITLE"],
  ])("%s=%s cai no padrão em vez de passar adiante", (parametro, valor) => {
    // ponytail: o padrao e a tela sem filtro, e nao um 404 nem "ignorar". O 404
    // transforma um erro de digitacao em "este site nao existe" para uma tela que
    // existe e funciona; e "ignorar" e impossivel porque quem ignoraria e o
    // dominio, que nao sabe o que a URL queria. Um `?orderBy=;drop` que chegasse
    // ao `listSellerItems` viraria nome de coluna no SQL.
    expect(le(`?${parametro}=${encodeURIComponent(valor)}`).orderBy).toBe("createdAt");
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
    (valor) => {
      expect(le(`?direction=${encodeURIComponent(valor)}`).direction).toBe("desc");
    },
  );

  it.each([["ASC"], ["up"], [""], ["asc "]])(
    "direction=%s com orderBy cai na ordem natural da coluna",
    (valor) => {
      expect(le(`?orderBy=title&direction=${encodeURIComponent(valor)}`)).toEqual(
        com({ orderBy: "title", direction: "asc" }),
      );
    },
  );

  it.each([["archived"], ["DRAFT"], ["active "], ["0"]])("status=%s vira sem filtro", (valor) => {
    expect(le(`?status=${encodeURIComponent(valor)}`).status).toBeNull();
  });

  // ponytail: o leitor aceita TODOS os status do `ROTULO_STATUS`, inclusive os que
  // nao tem aba. A lista de aceitos e derivada do mapa, e nao escrita a mao, para
  // nao poder divergir do vocabulario: um status novo entra no enum e no mapa e a
  // URL passa a filtra-lo sem ninguem editar este arquivo. A lista escrita a mao
  // viraria um status que a tela nao consegue filtrar.
  it("todo status do vocabulário é filtrável pela URL", () => {
    for (const status of Object.keys(ROTULO_STATUS) as ItemStatus[]) {
      expect(le(`?status=${status}`).status).toBe(status);
    }
  });
});

describe("estado-da-tabela — ida e volta", () => {
  // ponytail: a propriedade que fecha o arquivo. Uma vista lida da URL, reescrita
  // e relida tem que dar a MESMA vista, e o mesmo href. E o que garante que
  // "voltar/avancar", "copiar o link" e o "f5" nao mudem a tela — e o que impede
  // uma forma de URLNormalization de ping-pong entre dois estados (que e
  // mostraria a tela piscando a cada navegacao).
  it.each([
    VISTA_PADRAO,
    com({ q: "console retrô" }),
    com({ status: "closed" }),
    com({ orderBy: "title", direction: "asc" }),
    com({ orderBy: "minInitialBid", direction: "desc" }),
    com({ orderBy: "bidDeadline", direction: "asc" }),
    com({ page: 7, pageSize: 50 }),
    com({ q: "100% _a_", status: "paid", orderBy: "title", direction: "desc", page: 2, pageSize: 20 }),
  ])("a vista %# volta igual depois de passar pela URL", (vista) => {
    const href = hrefDaVista(vista);
    expect(hrefDaVista(le(consultaDe(vista).toString()))).toBe(href);
  });

  it("o parâmetro repetido vale o primeiro, como no URLSearchParams", () => {
    expect(le("?page=2&page=9").page).toBe(2);
  });
});

describe("estado-da-tabela — a vista virada em filtro do domínio", () => {
  it("sempre escreve orderBy e direction, mesmo na vista padrão", () => {
    // ponytail: e o que impede a armadilha do `createdAt`. Com `orderBy`
    // opcional, a vista "createdAt asc" viraria `{ direction: "asc" }` e o
    // default do repositorio (createdAt DESC) engoliria o asc.
    expect(filtroDaVista(com({ direction: "asc" }))).toEqual({
      orderBy: "createdAt",
      direction: "asc",
      limit: 10,
      offset: 0,
    });
  });

  it("converte página e tamanho em limit e offset", () => {
    expect(filtroDaVista(com({ page: 3, pageSize: 20 }))).toMatchObject({
      limit: 20,
      offset: 40,
    });
  });

  it("leva o termo e o status só quando existem", () => {
    expect(filtroDaVista(com({ q: "console", status: "draft" }))).toEqual({
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
    expect(Object.keys(filtroDaVista(VISTA_PADRAO)).sort()).toEqual([
      "direction",
      "limit",
      "offset",
      "orderBy",
    ]);
  });
});

describe("estado-da-tabela — a ponte entre a coluna da tela e a coluna do servidor", () => {
  // ponytail: os dois sentidos do mesmo par. O erro que o `tsc` NAO pega e um id
  // de coluna trocado aqui: o valor continua sendo um `ItemOrderBy` valido, a
  // seta aparece, a URL muda, e so quem sabe o mapeamento percebe que a tabela
  // voltou na ordem antiga. E por isso que o `items-list.dom.test.tsx` clica em
  // CADA cabecalho ordenavel e ve a `orderBy` que sai.
  //
  // O `it.each<[...]>` declara o tipo de cada coluna da tabela, e a anotacao nao e
  // decorativa: sem ela o `it.each` widenaria as duas celulas para `string`, e o
  // `colunaDaOrdenacao(orderBy)` viraria um `as` — que e o que apagaria deste
  // teste a unica verificacao que o compilador faz sobre o par (o `orderBy`
  // precisa ser membro da union para o segundo sentido compilar).
  it.each<[string, ItemOrderBy]>([
    ["titulo", "title"],
    ["lanceMinimo", "minInitialBid"],
    ["prazo", "bidDeadline"],
  ])("a coluna %s volta para %s", (coluna, orderBy) => {
    expect(ordenacaoDaColuna(coluna)).toBe(orderBy);
    expect(colunaDaOrdenacao(orderBy)).toBe(coluna);
  });

  it("createdAt é o padrão e não tem coluna na tela", () => {
    expect(colunaDaOrdenacao("createdAt")).toBeNull();
  });

  it("coluna que não está no contrato não vira orderBy", () => {
    expect(ordenacaoDaColuna("status")).toBeUndefined();
    expect(ordenacaoDaColuna("acoes")).toBeUndefined();
  });
});

describe("estado-da-tabela — a última página", () => {
  it.each([
    [0, 10, 1],
    [1, 10, 1],
    [10, 10, 1],
    [11, 10, 2],
    [100, 10, 10],
    [101, 10, 11],
    [100, 50, 2],
  ])("de %i itens em paginas de %i a ultima é %i", (total, pageSize, esperado) => {
    expect(ultimaPagina(total, pageSize)).toBe(esperado);
  });

  // ponytail: o piso 1 e o que impede o laco. Com `total = 0` nao existe ultima
  // pagina, e `hrefDaVista({ page: 0 })` devolveria uma URL que a leitura troca
  // por `page=1` — o `redirect` apontaria para a propria URL de origem e o
  // navegador ficaria redirecionando para sempre. Uma tela vazia e a PRIMEIRA
  // pagina vazia.
  it("sem itens a última página é a primeira, e não a página zero", () => {
    expect(ultimaPagina(0, 10)).toBe(1);
    expect(hrefDaVista(com({ page: ultimaPagina(0, 10) }))).toBe(CAMINHO_DA_LISTA);
  });
});
