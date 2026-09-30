import type { BuscarParametro } from "@/app/(dashboard)/dashboard/items/estado-da-tabela";

// ponytail: este arquivo e o CONTRATO DE URL da vitrine, e ele espelha
// `estado-da-tabela.ts` com DOIS parametros de URL (`q` e `ordenar`) em vez de
// SEIS (`q`, `status`, `orderBy`, `direction`, `page`, `pageSize`). A duplicacao
// e deliberada: os dois nao tem nada em comum alem do padrao (ler a URL num
// `Vista`, escrever de volta), e um modulo unico com dois formatos de vista
// seria um tipo `Vista` com seis campos opcionais e nenhuma combinacao valida.
// `BuscarParametro` e IMPORTADO, e nao re-declarado — duas definicoes do mesmo
// contrato e o mesmo defeito que `FUSO` e `primeiroValor` resolveram.
//
// ponytail: `ordenar` e `lance` e nao `preco` porque o que a vitrine ordena e o
// lance ATUAL (`max(bids.amount)`), nao o lance inicial (`items.min_initial_bid`,
// que e o "preço" deste produto). `?ordenar=preco` seria o nome do campo errado
// na URL, e a URL e o contrato publico desta tela.
//
// ponytail: a lista e a UNICA fonte da verdade e o tipo deriva dela —
// `as const` num array de tres nomes e `(typeof LISTA)[number]` e a unica forma
// de o compilador saber os tres nomes. O desenho invertido (uniao escrita a mao
// e Set escrito a mao ao lado) e o que o `estado-da-tabela.ts` evita com o
// `ROTULO_STATUS`: acrescentar "proximos" na lista muda a uniao E o `Set`
// juntos; no desenho invertido a uniao aceitaria "proximos" e o `Set` nao, e a
// ordenacao nova cairia em `"prazo"` em silencio, sem erro de tipo e sem teste
// vermelho.
const LISTA_DE_ORDENACOES = ["prazo", "lance", "recentes"] as const;

export type OrdenacaoDaVitrine = (typeof LISTA_DE_ORDENACOES)[number];

export interface VistaDaVitrine {
  q: string;
  ordenar: OrdenacaoDaVitrine;
}

// ponytail: o padrao e "Termina em breve", e nao "Mais recentes". A vitrine e a
// rota onde o visitante esta com dinheiro na mao e o item na tela: o que decide a
// conversao nao e o que foi publicado por ultimo, e o que esta acabando. O
// badge de urgencia do card (spec § 3.1) e o lado visual da mesma decisao.
export const VISTA_PADRAO_DA_VITRINE: VistaDaVitrine = { q: "", ordenar: "prazo" };

const ORDENACOES = new Set<string>(LISTA_DE_ORDENACOES);

function ehOrdenacao(bruto: string): bruto is OrdenacaoDaVitrine {
  return ORDENACOES.has(bruto);
}

// ponytail: `q` e aparado na LEITURA pelo mesmo motivo do `estado-da-tabela`: a
// caixa de busca e controlada pelo `q` da URL, entao um espaco nas pontas que
// sobrevivesse apareceria nela depois de um back/forward — e o que o usuario ve
// precisa ser o que o servidor filtrou. Aparar nas DUAS pontes e o que torna o
// `hrefDaVista` um ponto fixo: como ele apara o `q` antes de codificar, o
// endereco que sai ja e canonico e `emitir(ler(emitir(v))) === emitir(v)` para
// toda `v` — inclusive a que chegou com `q` suja. O que a leitura devolve nunca
// e a `v` original com os espacos: e o `q` que o servidor filtrou.
export function interpretarVitrine(buscar: BuscarParametro): VistaDaVitrine {
  const ordenar = buscar("ordenar");
  return {
    q: (buscar("q") ?? "").trim(),
    ordenar: ordenar !== null && ehOrdenacao(ordenar) ? ordenar : VISTA_PADRAO_DA_VITRINE.ordenar,
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
export function hrefDaVista(slug: string, vista: VistaDaVitrine): string {
  const partes: string[] = [];
  const termo = vista.q.trim();
  if (termo !== "") partes.push(`q=${encodeURIComponent(termo)}`);
  if (vista.ordenar !== VISTA_PADRAO_DA_VITRINE.ordenar) partes.push(`ordenar=${vista.ordenar}`);
  return partes.length === 0 ? `/${slug}` : `/${slug}?${partes.join("&")}`;
}
