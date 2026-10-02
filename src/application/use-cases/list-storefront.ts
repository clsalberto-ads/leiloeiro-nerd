import type { Item, StorefrontItem, ItemListFilter, ItemRepository } from "@/domain/repositories/item-repository";
import type { BidStats, BidStatsList } from "@/domain/repositories/bid-repository";
import type { StorefrontSort, StorefrontView } from "@/app/(public)/[slug]/storefront-state";

// ponytail: no sort "Maior lance", item SEM lance vai para o FIM, e a decisao e
// comparada ANTES de qualquer aritmetica. Uma sentinela (`-Infinity`) seria mais
// curta e estaria ERRADA: dois itens sem lance dariam `-Infinity - -Infinity`, que
// e `NaN` — e `NaN !== 0` e verdadeiro, entao o comparador devolvia `NaN` em vez
// de cair no desempate por prazo. O desempate nunca rodava e a ordem de dois itens
// sem lance ficava a cargo do `sort`. Comparar os `null` direto e o que torna o
// comparador TOTAL por construcao, e apaga a sentinela em vez de acrescentar um
// numero magico que so funciona por acaso do IEEE754.
//
// A ordem de quem vai para o fim e a que faz "o maior lance tem sempre a primeira
// posicao" ser verdade: um item sem lance algum nao tem lance atual, e um item sem
// lance no topo de "Maior lance" seria a tela dizendo o oposto do rotulo.

function compare(a: StorefrontItem, b: StorefrontItem, sort: StorefrontSort): number {
  switch (sort) {
    case "lance": {
      const aWithoutBid = a.highestBid === null;
      const bWithoutBid = b.highestBid === null;
      if (aWithoutBid !== bWithoutBid) return aWithoutBid ? 1 : -1;
      // Desempate por prazo. E o mesmo que o resto da tela usa, e ele e OBRIGATORIO
      // aqui porque dois itens sem lance caem nele: sem o desempate, a ordem entre
      // eles seria a ordem de entrada do array, e mudaria entre dois renders do
      // mesmo conjunto.
      if (!aWithoutBid) {
        const byBid = (b.highestBid as number) - (a.highestBid as number);
        if (byBid !== 0) return byBid;
      }
      return byDeadline(a, b);
    }
    case "recentes":
      return byCreatedAt(a, b);
    case "prazo":
      return byDeadline(a, b);
  }
}

// ponytail: os tres sorts terminam num desempate por `id`, e e o que torna o
// comparador TOTAL. Sem ele, dois itens com o mesmo instante ficam na ordem em que
// o repositorio os devolveu — e o `findBySellerId` tambem nao garante essa ordem
// quando ha empate de `createdAt`. A ordem da vitrine passaria a depender de query
// plan, que e o tipo de coisa que muda sem ninguem mexer.
//
// O desempate por `id` e ARBITRARIO e tudo bem: ele so decide itens que sao
// indistinguiveis pela chave que o visitante escolheu. O que nao pode ser
// arbitrario e a chave principal.
function byCreatedAt(a: StorefrontItem, b: StorefrontItem): number {
  const diferenca = b.createdAt.getTime() - a.createdAt.getTime();
  if (diferenca !== 0) return diferenca;
  return byId(a, b);
}

function byDeadline(a: StorefrontItem, b: StorefrontItem): number {
  const diferenca = a.bidDeadline.getTime() - b.bidDeadline.getTime();
  if (diferenca !== 0) return diferenca;
  return byId(a, b);
}

function byId(a: StorefrontItem, b: StorefrontItem): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ponytail: `[...itens]` antes do `.sort()`. `Array.prototype.sort` e IN-PLACE, e
// ordenar o array que o repositorio devolveu faria o `findBySellerId` seguinte
// receber um array ja reordenado sem ele saber — o tipo classico de bug que so
// aparece quando dois consumidores aparecem na mesma tela.
export function sortForStorefront(items: StorefrontItem[], sort: StorefrontSort): StorefrontItem[] {
  return [...items].sort((a, b) => compare(a, b, sort));
}

// ponytail: a ordenacao e EM JS, e nao no SQL, por um motivo medido. A vitrine nao
// pagina (decisao de escopo), entao ela JA carrega o conjunto inteiro em memoria
// — o `ORDER BY` do banco nao evita nenhuma leitura. E o `highestBid` e buscado de
// qualquer forma, porque o card precisa dele para mostrar o lance atual: ele ja
// vem de UMA consulta em lote, a `drizzleBidStatsList`
// (`drizzle-bid-repository.ts:135`), um `GROUP BY bids.item_id` index-only pelo
// indice `(item_id, amount DESC)` — e nao de uma subquery por item. Ordenar por um
// array que ja esta na mao e `Array.prototype.sort`; a alternativa (um
// `LEFT JOIN bids` com `max(bids.amount)` dentro do `ORDER BY` do repositorio)
// NAO pagaria leitura nenhuma, e sim repetiria o MESMO agregado numa segunda
// consulta sobre `bids` — e dois `GROUP BY` sobre lances sao justamente o caminho
// em que os dois divergem: e o risco que o `ponytail:` de `bid-repository.ts:47`
// ja escreve para o `cancelBidByItem` que ainda nao existe, cujo filtro teria de
// entrar nos dois lugares. O bonus: o numero que decide a posicao e LITERALMENTE o
// mesmo que o card exibe, porque e a MESMA leitura, nao duas.
//
// O `q` CONTINUA no SQL: e substring insensivel a caixa e acento sobre titulo +
// rotulos, e reimplementar isso em JS seria uma segunda implementacao da mesma
// regra. Entao a consulta e meio SQL (filtrar) e meio JS (ordenar) — e a divisao
// segue quem tem o dado: o filtro tem o `CASE` de rotulos, a ordem tem o agregado
// de lances.
//
// TETO: o conjunto inteiro em memoria. Um vendedor com 5.000 itens ativos paga
// 5.000 linhas mais 5.000 chaves de mapa por request, e o `sort` em JS perde o
// indice do banco. UPGRADE PATH: quando esse numero incomodar, a ordem sai pelo
// caminho MINIMO, que e a porta que ja existe — `BidStatsList` ganhar um
// `ordenar` e devolver os ids JA ordenados (o mesmo `sort` em JS, so que dos
// ids, e o `Map` continua sendo uma unica leitura); o caminho COMPLETO e a
// listagem ganhar o `LEFT JOIN` com
// `orderBy sql`(max(bids.amount) desc nulls last)`` — o `nulls last` e
// obrigatorio, e nao enfeite: o padrao do Postgres em `DESC` e `NULLS FIRST`, que
// e o item sem lance no topo de "Maior lance" de novo. O `contested` do
// `drizzle-analytics-repository.ts:99` NAO e o padrao a copiar aqui: ele resolve o
// problema oposto, porque o `having count(bids.id) > 0` DEITA fora o item sem
// lance — que na vitrine e justamente o que tem de aparecer, no fim — e o
// `desc(max(bids.amount))` dele nao tem `nulls last`. Nada alem do
// `sortForStorefront` muda quando isso acontecer.
export async function listStorefront(
  itemRepo: Pick<ItemRepository, "findBySellerId">,
  bidRepo: BidStatsList,
  sellerId: string,
  view: StorefrontView,
): Promise<StorefrontItem[]> {
  const itemFilter: ItemListFilter = { status: "active" };
  if (view.q !== "") itemFilter.q = view.q;
  const items: Item[] = await itemRepo.findBySellerId(sellerId, itemFilter);
  if (items.length === 0) return [];

  const ids = items.map((i) => i.id);
  const estatisticas: Map<string, BidStats> = await bidRepo.ofManyItems(ids);

  const dtos: StorefrontItem[] = items.map((item) => {
    const stat = estatisticas.get(item.id);
    return {
      id: item.id,
      title: item.title,
      type: item.type,
      minInitialBid: item.minInitialBid,
      bidDeadline: item.bidDeadline,
      imageUrl: item.imageUrl,
      totalBids: stat?.total ?? 0,
      highestBid: stat?.maior ?? null,
      createdAt: item.createdAt,
    };
  });

  return sortForStorefront(dtos, view.sort);
}