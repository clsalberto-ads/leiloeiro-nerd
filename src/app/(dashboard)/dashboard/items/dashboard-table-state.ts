import {
  STATUS_LABELS,
  type ItemListFilter,
  type ItemOrderBy,
  type ItemSortDirection,
  type ItemStatus,
} from "@/domain/repositories/item-repository";

// ponytail: este arquivo e o CONTRATO DA URL da lista de itens: uma funcao le a
// URL e devolve a vista, outra escreve a vista de volta na URL, e uma terceira
// traduz a vista no filtro do dominio. Nenhuma delas e um componente, nenhuma
// importa `next/*` e nenhuma guarda estado — e por isso que a pagina (servidor) e
// a `ItemsList` (cliente) podem ler e escrever a MESMA vista com as MESMAS
// funcoes, e que um parametro nao tem como virar duas respostas diferentes
// dependendo de quem leu.
//
// A ordem em que os parametros saem na URL e fixa (busca, aba, ordenacao, pagina,
// tamanho), e nao e estetica: duas vistas iguais produzem a MESMA string, que e o
// que faz "copiar e colar o link" funcionar. Sem isso, `?orderBy=title&page=2` e
// `?page=2&orderBy=title` seriam a mesma tela com dois enderecos, e o botao
// "voltar" do navegador nao saberia qual dos dois desfazer.
export const DASHBOARD_ITEMS_PATH = "/dashboard/items";

// ponytail: `direction` tem DOIS padroes, e eles nao sao o mesmo valor. E o ponto
// que um leitor apressado confunde, entao vale o dobro:
//
//   `DEFAULT_SORT_DIRECTION` ("desc") e a direcao da VISTA padrao — a tela sem
//   nenhum parametro, que e "do mais recente para o mais antigo". E o que o
//   `buildDashboardHref` NAO escreve: a vista padrao e a string vazia.
//
//   `ASSUMED_SORT_DIRECTION` ("asc") e o que o LEITOR assume quando `orderBy` foi
//   escrito e `direction` nao, e coincide com o default do `ItemListFilter`
//   ("direction ausente = asc para toda coluna pedida", do `ponytail:` da union).
//   Nao e a vista padrao: e a direcao que vale para uma coluna que o usuario
//   acabou de escolher.
//
// E o "quando `orderBy` foi escrito" que faz os dois se encontrarem. Sem ele, a
// URL vazia leria `createdAt asc` — a lista do mais antigo para o mais novo como
// primeira tela, com a URL nao dizendo nada e o cabecalho sem seta. A regra
// inteira cabe numa frase: **`orderBy` escrito e `direction` ausente = "a ordem
// natural daquela coluna"; nada escrito = a tela padrao**.
//
// A consequencia pratica e a unica regra nao obvia do `buildDashboardHref`: `direction`
// pode ser omitido quando `orderBy` foi escrito (o leitor assume "asc"), e NUNCA
// quando `orderBy` e a vista padrao `createdAt` (o leitor assume "desc", que e a
// tela). Sem essa distincao, `?direction=asc` — "dos mais antigos para os mais
// novos", uma tela legitima que ninguem reacha por clique porque `createdAt` nao
// tem coluna na tela — voltaria para a tela padrao quando lida de volta.
export const DEFAULT_SORT_DIRECTION: ItemSortDirection = "desc";
export const ASSUMED_SORT_DIRECTION: ItemSortDirection = "asc";

// ponytail: `createdAt` e o padrao de ORDENACAO e nao de direcao. E o default
// que o `listSellerItems` ja usava antes de existir URL, e por isso que ele nao
// aparece na URL: a vista sem parametro ja e "os mais recentes primeiro".
export const DEFAULT_SORT_BY: ItemOrderBy = "createdAt";

export const DEFAULT_PAGE = 1;
// ponytail: o 10 e o mesmo numero que o `DataTable` ja oferece
// (`PAGE_SIZES`), e ele aparece aqui porque a PAGINA e um parametro da
// URL: se o padrao vivesse so no componente, a pagina teria de descobrir qual era
// lendo o componente cliente, e `?page=2` nao saberia quantas linhas pular. Sao
// dois lugares com o mesmo numero e uma `ponytail:` em cada apontando o outro —
// derivar um do outro seria o componente generico decidindo a politica de uma
// pagina que ele nao conhece.
export const DEFAULT_PAGE_SIZE = 10;
// ponytail: teto do `pageSize`, e ele existe porque o parametro vem da URL. Sem
// teto, `?pageSize=99999` seria uma instrucao legitima de renderizar 99.999
// linhas numa tabela que o usuario abriu para ler 10, e o "ataque" seria so uma
// URL colada de um lugar. 100 e generoso para a lista de itens de um vendedor e
// ainda limita o trabalho de um clique. O que o teto NAO faz e arredondar para o
// tamanho mais proximo da lista do `Select` (5/10/20/50): um `pageSize=30` e uma
// escolha legitima, e trocar 30 por 50 em silencio seria pior do que respeitar.
export const MAX_PAGE_SIZE = 100;

// ponytail: `q` NAO tem teto, e a decisao e deliberada. Cortar o termo no meio
// muda o CONJUNTO que a busca devolve, nao so o tamanho da query: um termo de 300
// letras que comeca com um titulo inteiro de 150 letras acha o item cortado e nao
// acha o termo inteiro. Um teto que devolve "menos do que a URL pedia" e a mesma
// classe de mentira do `total` contado antes do filtro. O que realmente limita o
// `q` e o tamanho da URL, e o que protege o banco e o `q` ir como PARAMETRO do
// drizzle (verificado contra o Postgres 17 pela parte 1 desta tarefa): nao ha
// concatenacao, entao nao ha aspa que quebre.
export interface DashboardTableView {
  // ponytail: `""` e "sem busca", e nao `null`. O `listSellerItems` apara e trata
  // o termo em branco como ausencia, entao os dois jeitos chegam no mesmo lugar,
  // e um `null` aqui seria um terceiro estado que so o emissor teria de saber
  // tratar.
  q: string;
  // ponytail: `null` e "todos os status" — e nao `""`, porque `""` nao e um
  // `ItemStatus` e a aba "Todos" nao e um filtro, e um filtro ausente.
  status: ItemStatus | null;
  // ponytail: `orderBy` e `direction` sao sempre preenchidos aqui, nunca
  // `undefined`: a VISTA e o estado que a tela esta mostrando, e nao o que a URL
  // escreveu. A distincao "ausente" vive so no par URL-dominio, e e ela que faz
  // `?direction=asc` significar "createdAt asc" em vez de "createdAt desc" (veja
  // `ASSUMED_SORT_DIRECTION`).
  orderBy: ItemOrderBy;
  direction: ItemSortDirection;
  page: number;
  pageSize: number;
}

export const DEFAULT_TABLE_VIEW: DashboardTableView = {
  q: "",
  status: null,
  orderBy: DEFAULT_SORT_BY,
  direction: DEFAULT_SORT_DIRECTION,
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
};

// ponytail: o leitor recebe uma funcao e nao um objeto de `searchParams`, e a
// diferenca nao e cosmetica. O `searchParams` do Next e
// `Record<string, string | string[] | undefined>` e o `URLSearchParams` do
// cliente e outra coisa; a funcao de busca e o unico formato que os dois
// implementam sem adaptador, entao a pagina e a tabela leem a URL pela MESMA
// porta. Um parametro repetido e resolvido no adaptador, com o primeiro valor —
// que e o que `URLSearchParams.get` devolve, e por isso que servidor e cliente
// concordam.
export type SearchParamGetter = (name: string) => string | null;

// ponytail: o unico cast do arquivo, e ele esta numa funcao so porque
// `Object.keys` devolve `string[]` para qualquer objeto. A alternativa seria uma
// lista escrita a mao dos status aceitos, e ela nao existe por um motivo que o
// `tsc` nao veria: a lista derivaria do `STATUS_LABELS` (para nao poder divergir
// do vocabulario) e ainda assim seria uma copia — um status novo entraria no enum
// e no mapa, e a URL so o aceitaria se alguem lembrasse desta linha. A lista
// escrita a mao divergiria do nada e viraria um status que a tela nao consegue
// filtrar, que e o mesmo defeito das abas (e e por isso que as abas usam
// `satisfies` + `ponytail:`).
function keysOf<T extends string>(labels: Record<T, string> | undefined | null): T[] {
  if (!labels || typeof labels !== "object") return [] as T[];
  return Object.keys(labels) as T[];
}

const VALID_STATUSES = new Set<string>(keysOf(STATUS_LABELS));

// ponytail: a ponte entre a coluna que o usuario clica e a coluna que o servidor
// sabe ordenar, nos DOIS sentidos. O mapa e `Record<ItemOrderBy, string | null>`
// por um motivo de compilador: um `orderBy` novo no dominio sem linha aqui e erro
// de compilacao, e nao um `orderBy` que a URL aceita e a tabela nunca produz.
// `createdAt` e `null` porque nao tem coluna na tela — e o padrao, nao uma opcao.
//
// Os dois sentidos ficam em duas tabelas (e nao uma so com um `find`) porque as
// chaves vem de dominios diferentes: uma e a union do dominio, a outra e o id de
// coluna que o `DataTable` inventou. Um `id` de coluna errado e o unico erro que
// o compilador NAO pega (o valor continua sendo um `ItemOrderBy` valido), e quem
// pega e o teste de DOM que clica em cada cabecalho ordenavel e ve a URL que sai.
// ponytail: com o id de coluna em ingles, estas duas tabelas viraram quase
// identidade — e mesmo assim NAO viraram `orderBy === column`. Elas sao a
// WHITELIST de colunas ordenaveis: `status`, `type` e `actions` nao aparecem
// aqui, e e por isso que `sortOrderByColumn` devolve `undefined` para elas e o
// `items-list.tsx` ignora o clique em vez de escrever `?orderBy=status`, que o
// leitor rejeitaria e trocaria pelo padrao (a URL mentindo sobre o que esta
// ordenado). `createdAt: null` e o mesmo acordo pelo outro lado: ordenavel na
// URL, sem coluna na tela.
const SORT_COLUMN_BY_ORDER: Record<ItemOrderBy, string | null> = {
  createdAt: null,
  title: "title",
  minInitialBid: "minInitialBid",
  bidDeadline: "bidDeadline",
};

const SORT_ORDER_BY_COLUMN: Record<string, ItemOrderBy | undefined> = {
  title: "title",
  minInitialBid: "minInitialBid",
  bidDeadline: "bidDeadline",
};

export function sortColumnByOrder(order: ItemOrderBy): string | null {
  return SORT_COLUMN_BY_ORDER[order];
}

export function sortOrderByColumn(column: string): ItemOrderBy | undefined {
  return SORT_ORDER_BY_COLUMN[column];
}

// ponytail: numero de URL nao vira numero de tela sem passar por tres filtros, e
// cada um deles e uma decisao diferente:
//
//   o que a tela NAO produz -> o PADRAO. O filtro e `SO_DIGITOS`, e ele e
//     deliberadamente mais estreito que "numero": `1.5`, `1e999`, `0x10`, `+5` e
//     `12 ` sao todos numeros para o `Number`, e nenhum deles pode ter vindo da
//     tela (o `Select` oferece 5/10/20/50 e o "proxima" soma 1). A tela so produz
//     digitos, entao aceitar o resto e inventar um estado que ela nao sabe exibir.
//     E o que a tela deveria mostrar depois de um erro de digitacao e a tela
//     normal, nao um 500 nem um `LIMIT must not have a decimal` do Postgres.
//
//   inteiro fora de faixa -> o TETO (`pageSize`) ou o MINIMO (1). Aqui o numero
//     e valido, so que absurdo: `?pageSize=99999` e um ataque de primeira
//     categoria nao porque seja codigo malicioso, e porque e a menor URL que
//     derruba a tabela. E `?pageSize=0` e o outro extremo: zero e "todos os itens"
//     para o `listSellerItems` (o `limit <= 0` some) e e divisao por zero no
//     rodape do `DataTable` — o parametro precisa chegar na tela com pelo menos 1.
//
//   `page` nao tem teto: um `page=99999` e inofensivo (o `OFFSET` devolve vazio e
//     a pagina redireciona para a ultima, veja `lastPage`), e um teto
//     arbitrario seria mais um numero para lembrar sem impedir nada.
const DIGITS_ONLY = /^\d+$/;

function parseIntOrNull(bruto: string | null): number | null {
  if (bruto === null || !DIGITS_ONLY.test(bruto)) return null;
  const parsed = Number(bruto);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function isValidStorefrontSort(bruto: string): bruto is ItemOrderBy {
  return Object.hasOwn(SORT_COLUMN_BY_ORDER, bruto);
}

function isValidStatus(bruto: string): bruto is ItemStatus {
  return VALID_STATUSES.has(bruto);
}

// ponytail: `orderBy` invalido NAO vira 404 e NAO e ignorado — ele cai no padrao,
// que e a tela sem filtro nenhum. As duas saidas ruins tem o mesmo defeito com
// os sinais trocados: o 404 transforma um erro de digitacao (ou o link de uma
// versao antiga da tela, de antes de a coluna existir) em "este site nao existe"
// para uma tela que existe e funciona; e "ignorar" e impossivel aqui porque quem
// ignoraria e o dominio, e o dominio nao sabe o que a URL queria. Um
// `?orderBy=;drop` que chegasse ao `listSellerItems` viraria nome de coluna no
// SQL; a validacao acontece na fronteira, e a fronteira e que decide o que fazer
// com o que nao presta. O mesmo vale para `direction` e `status`: padrao.
//
// A DIRECAO e o unico padrao que depende de outra coisa: ela e "asc" quando um
// `orderBy` valido foi escrito, e "desc" (a tela) quando nenhum foi. Ver
// `ASSUMED_SORT_DIRECTION` para a frase que fecha as duas.
export function parseDashboardParams(searchParams: SearchParamGetter): DashboardTableView {
  const page = parseIntOrNull(searchParams("page"));
  const pageSize = parseIntOrNull(searchParams("pageSize"));
  const orderBy = searchParams("orderBy");
  const direction = searchParams("direction");
  const status = searchParams("status");
  const writtenSort = orderBy !== null && isValidStorefrontSort(orderBy);
  return {
    q: (searchParams("q") ?? "").trim(),
    status: status !== null && isValidStatus(status) ? status : null,
    orderBy: writtenSort ? orderBy : DEFAULT_SORT_BY,
    direction:
      direction === "asc" || direction === "desc"
        ? direction
        : writtenSort
          ? ASSUMED_SORT_DIRECTION
          : DEFAULT_SORT_DIRECTION,
    page: page !== null && page >= DEFAULT_PAGE ? page : DEFAULT_PAGE,
    pageSize:
      pageSize === null
        ? DEFAULT_PAGE_SIZE
        : Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize)),
  };
}

// ponytail: o `q` e aparado aqui e nao so na leitura, e o motivo e a caixa. A
// caixa de busca e controlada pelo `q` da URL, entao um espaco nas pontas que
// sobrevivesse na URL apareceria nela depois de um back/forward — e o campo de
// texto e a unica parte da tela que o usuario pode REESCREVER, entao o que ele ve
// precisa ser o que o servidor filtrou. Aparar nas duas pontes torna o
// `buildDashboardHref` ponto fixo: `buildDashboardHref(parseDashboardParams(ler(buildDashboardHref(v))))`
// devolve a MESMA string de `buildDashboardHref(v)`, para toda `v`.
//
// ponytail: a propriedade e do HREF e nao da VISTA, e a distincao e o que evita
// um comentario que mente. `ler(emitir(v)) === emitir(v)` compara uma
// `DashboardTableView` com uma `string` e e FALSO: com `q` suja (`"  console  "`), ler
// volta o valor aparado, que nao e a `DashboardTableView` original. O que vale e que a
// NORMALIZACAO e da escrita — o `buildDashboardHref` apara antes de codificar (linha
// abaixo) — e por isso que reescrever o endereco lido devolve o endereco. O mesmo
// vale no modulo irmao da vitrine (`[slug]/storefront-state.ts`), e o caso de
// teste com `q` suja esta em `dashboard-table-state.test.ts`.
function encodeQuery(value: string): string {
  return encodeURIComponent(value);
}

// ponytail: `URLSearchParams` nao serve aqui porque ele escreve espaco como `+`,
// e `+` em query string e lido como espaco por um decodificador e como "mais" por
// outro. `encodeURIComponent` escreve `%20`, que todo mundo le como espaco. O
// resto do encoding (`%`, `&`, `=`, acento) e o mesmo, e o teste do `q` com `%` e
// `_` prova que a volta devolve os dois literais.
export function buildDashboardHref(view: DashboardTableView): string {
  const parts: string[] = [];
  const searchTerm = view.q.trim();
  if (searchTerm !== "") parts.push(`q=${encodeQuery(searchTerm)}`);
  if (view.status !== null) parts.push(`status=${view.status}`);
  if (view.orderBy !== DEFAULT_SORT_BY || view.direction !== DEFAULT_SORT_DIRECTION) {
    if (view.orderBy !== DEFAULT_SORT_BY) parts.push(`orderBy=${view.orderBy}`);
    if (view.direction !== ASSUMED_SORT_DIRECTION || view.orderBy === DEFAULT_SORT_BY) {
      parts.push(`direction=${view.direction}`);
    }
  }
  if (view.page !== DEFAULT_PAGE) parts.push(`page=${view.page}`);
  if (view.pageSize !== DEFAULT_PAGE_SIZE) parts.push(`pageSize=${view.pageSize}`);
  return parts.length === 0 ? DASHBOARD_ITEMS_PATH : `${DASHBOARD_ITEMS_PATH}?${parts.join("&")}`;
}

// ponytail: `orderBy` e `direction` saem SEMPRE explicitos, nunca `undefined`, e
// isso e o que fecha a armadilha do `createdAt`. Se a pagina mandasse
// `orderBy: undefined` para a vista "createdAt asc", o dominio receberia so
// `direction: "asc"` e o trataria assim: o default de `orderBy` ja e
// descendente, entao o `asc` explicito seria engolido e o usuario veria a tela ao
// contrario do que a URL pedia. Escrevendo o par inteiro nao ha ambiguidade: a
// vista e o filtro sao a mesma frase.
export function toDashboardFilter(view: DashboardTableView): ItemListFilter {
  const itemFilter: ItemListFilter = {
    orderBy: view.orderBy,
    direction: view.direction,
    limit: view.pageSize,
    offset: (view.page - 1) * view.pageSize,
  };
  if (view.q !== "") itemFilter.q = view.q;
  if (view.status !== null) itemFilter.status = view.status;
  return itemFilter;
}

// ponytail: a ultima pagina tem piso 1, e o piso e o caso que a divisao sozinha nao
// cobre: com `total = 0` nao existe ultima pagina, e sem o piso o `buildDashboardHref`
// receberia `page = 0` — que a leitura rejeitaria e trocaria por 1 de novo, entao
// a URL do redirecionamento seria a mesma que a de origem e o browser entraria em
// laco. Uma tela vazia e a PRIMEIRA pagina vazia.
export function lastPage(total: number, pageSize: number): number {
  return Math.max(DEFAULT_PAGE, Math.ceil(total / pageSize));
}
