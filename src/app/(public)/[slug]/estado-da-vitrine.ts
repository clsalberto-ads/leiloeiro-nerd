import type { BuscarParametro } from "@/app/(dashboard)/dashboard/items/estado-da-tabela";

// ponytail: este arquivo e o CONTRATO DE URL da vitrine, e ele espelha
// `estado-da-tabela.ts` com tres parametros em vez de sete. A duplicacao e
// deliberada: os dois nao tem nada em comum alem do padrao (ler a URL num
// `Vista`, escrever de volta), e um modulo unico com dois formatos de vista
// seria um tipo `Vista` com seis campos opcionais e nenhuma combinacao valida.
// `BuscarParametro` e IMPORTADO, e nao re-declarado — duas definicoes do mesmo
// contrato e o mesmo defeito que `FUSO` e `primeiroValor` resolveram.
//
// ponytail: `ordenar` e `lance` e nao `preco` porque o que a vitrine ordena e o
// lance ATUAL (`max(bids.amount)`), nao o lance inicial (`items.min_initial_bid`,
// que e o "preço" deste produto). `?ordenar=preco` seria o nome do campo errado
// na URL, e a URL e o contrato publico desta tela.
export type OrdenacaoDaVitrine = "prazo" | "lance" | "recentes";

export interface VistaDaVitrine {
  q: string;
  ordenar: OrdenacaoDaVitrine;
}

// ponytail: o padrao e "Termina em breve", e nao "Mais recentes". A vitrine e a
// rota onde o visitante esta com dinheiro na mao e o item na tela: o que decide a
// conversao nao e o que foi publicado por ultimo, e o que esta acabando. O
// badge de urgencia do card (spec § 3.1) e o lado visual da mesma decisao.
export const VISTA_PADRAO_DA_VITRINE: VistaDaVitrine = { q: "", ordenar: "prazo" };

const ORDENACOES = new Set<string>(["prazo", "lance", "recentes"]);

function ehOrdenacao(bruto: string): bruto is OrdenacaoDaVitrine {
  return ORDENACOES.has(bruto);
}

// ponytail: `q` e aparado na LEITURA pelo mesmo motivo do `estado-da-tabela`: a
// caixa de busca e controlada pelo `q` da URL, entao um espaco nas pontas que
// sobrevivesse apareceria nela depois de um back/forward — e o que o usuario ve
// precisa ser o que o servidor filtrou. Aparar nas duas pontes torna o
// `hrefDaVista` ponto fixo: ler(emitir(v)) === emitir(v) para toda vista.
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
