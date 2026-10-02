import type { SearchParamGetter } from "@/app/(dashboard)/dashboard/items/dashboard-table-state";

// ponytail: este arquivo e o CONTRATO DE URL da vitrine, e ele espelha
// `dashboard-table-state.ts` com DOIS parametros de URL (`q` e `ordenar`) em vez de
// SEIS (`q`, `status`, `orderBy`, `direction`, `page`, `pageSize`). A duplicacao
// e deliberada: os dois nao tem nada em comum alem do padrao (ler a URL num
// `Vista`, escrever de volta), e um modulo unico com dois formatos de vista
// seria um tipo `Vista` com seis campos opcionais e nenhuma combinacao valida.
// `SearchParamGetter` e IMPORTADO, e nao re-declarado — duas definicoes do mesmo
// contrato e o mesmo defeito que `APP_TIMEZONE` e `firstValue` resolveram.
//
// ponytail: `ordenar` e `lance` e nao `preco` porque o que a vitrine ordena e o
// lance ATUAL (`max(bids.amount)`), nao o lance inicial (`items.min_initial_bid`,
// que e o "preço" deste produto). `?ordenar=preco` seria o nome do campo errado
// na URL, e a URL e o contrato publico desta tela.
//
// ponytail: a lista e a UNICA fonte da verdade e o tipo deriva dela —
// `as const` num array de tres nomes e `(typeof LISTA)[number]` e a unica forma
// de o compilador saber os tres nomes. O desenho invertido (uniao escrita a mao
// e Set escrito a mao ao lado) e o que o `dashboard-table-state.ts` evita com o
// `STATUS_LABELS`: acrescentar "proximos" na lista muda a uniao E o `Set`
// juntos; no desenho invertido a uniao aceitaria "proximos" e o `Set` nao, e a
// ordenacao nova cairia em `"prazo"` em silencio, sem erro de tipo e sem teste
// vermelho.
//
// ponytail: a lista e EXPORTADA porque o consumidor seguinte precisa dela em
// runtime, e nao so em tempo de compilacao: quem desenhar os botoes de ordenacao
// vai percorrer esta lista na ordem em que a tela mostra, e e essa ordem que a
// tela e a URL precisam concordar. Escrever os tres nomes de novo no consumidor
// seria reintroduzir a duplicacao que este desenho existe para matar — em uma
// lista de botoes e num `switch` de rotulo, em dois arquivos diferentes. O que a
// lista nao carrega e a ordem de leitura da tela: ela e so o vocabulario, e quem
// consome decide em que ordem mostrar.
export const STOREFRONT_SORT_OPTIONS = ["prazo", "lance", "recentes"] as const;

export type StorefrontSort = (typeof STOREFRONT_SORT_OPTIONS)[number];

export interface StorefrontView {
  q: string;
  sort: StorefrontSort;
}

// ponytail: o padrao e "Termina em breve", e nao "Mais recentes". A vitrine e a
// rota onde o visitante esta com dinheiro na mao e o item na tela: o que decide a
// conversao nao e o que foi publicado por ultimo, e o que esta acabando. O
// badge de urgencia do card (spec § 3.1) e o lado visual da mesma decisao.
export const DEFAULT_STOREFRONT_VIEW: StorefrontView = { q: "", sort: "prazo" };

const SORT_OPTIONS_SET = new Set<string>(STOREFRONT_SORT_OPTIONS);

function isValidStorefrontSort(raw: string): raw is StorefrontSort {
  return SORT_OPTIONS_SET.has(raw);
}

// ponytail: `q` e aparado na LEITURA pelo mesmo motivo do `estado-da-tabela`: a
// caixa de busca e controlada pelo `q` da URL, entao um espaco nas pontas que
// sobrevivesse apareceria nela depois de um back/forward — e o que o usuario ve
// precisa ser o que o servidor filtrou. Aparar nas DUAS pontes e o que torna o
// `buildStorefrontHref` um ponto fixo: como ele apara o `q` antes de codificar, o
// endereco que sai ja e canonico e `emitir(ler(emitir(v))) === emitir(v)` para
// toda `v` — inclusive a que chegou com `q` suja. O que a leitura devolve nunca
// e a `v` original com os espacos: e o `q` que o servidor filtrou.
export function parseStorefrontView(searchParams: SearchParamGetter): StorefrontView {
  const sort = searchParams("ordenar");
  return {
    q: (searchParams("q") ?? "").trim(),
    sort: sort !== null && isValidStorefrontSort(sort) ? sort : DEFAULT_STOREFRONT_VIEW.sort,
  };
}

// ponytail: o `slug` entra como PARAMETRO e nao como constante com placeholder.
// O caminho e "/" + slug, e um `"/{slug}"` entre as aspas seria uma string que
// esta funcao teria de substituir — uma regex no fim das contas, para um
// caminho que e concatenacao.
//
// ponytail: `URLSearchParams` nao serve aqui porque escreve espaco como `+`, e
// `+` em query string e lido como espaco por um decodificador e como "mais" por
// outro. `encodeURIComponent` escreve `%20`, que todo mundo le como espaco.
export function buildStorefrontHref(slug: string, view: StorefrontView): string {
  const parts: string[] = [];
  const searchTerm = view.q.trim();
  if (searchTerm !== "") parts.push(`q=${encodeURIComponent(searchTerm)}`);
  if (view.sort !== DEFAULT_STOREFRONT_VIEW.sort) parts.push(`ordenar=${view.sort}`);
  return parts.length === 0 ? `/${slug}` : `/${slug}?${parts.join("&")}`;
}
