import type { Item, ItemDaVitrine, ItemListFilter, ItemRepository } from "@/domain/repositories/item-repository";
import type { EstatisticasDeLance, EstatisticasDeLances } from "@/domain/repositories/bid-repository";
import type { OrdenacaoDaVitrine, VistaDaVitrine } from "@/app/(public)/[slug]/estado-da-vitrine";

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

function comparar(a: ItemDaVitrine, b: ItemDaVitrine, ordenar: OrdenacaoDaVitrine): number {
  switch (ordenar) {
    case "lance": {
      const aSemLance = a.maiorLance === null;
      const bSemLance = b.maiorLance === null;
      if (aSemLance !== bSemLance) return aSemLance ? 1 : -1;
      // Desempate por prazo. E o mesmo que o resto da tela usa, e ele e OBRIGATORIO
      // aqui porque dois itens sem lance caem nele: sem o desempate, a ordem entre
      // eles seria a ordem de entrada do array, e mudaria entre dois renders do
      // mesmo conjunto.
      if (!aSemLance) {
        const porLance = (b.maiorLance as number) - (a.maiorLance as number);
        if (porLance !== 0) return porLance;
      }
      return a.bidDeadline.getTime() - b.bidDeadline.getTime();
    }
    case "recentes":
      // ponytail: "recentes" usa o `id` como desempate, nao `createdAt`, porque o
      // DTO nao carrega `createdAt` (nao aparece em lugar nenhum do card). Como
      // o `id` e um uuid, o desempate e estavel e total, que e o que o
      // comparador precisa ser — mas ele e ARBITRARIO entre itens com o mesmo
      // instante, o que e aceitavel porque o `createdAt` tem precisao de
      // segundos. O upgrade path, se dois itens dependerem dessa ordem, e
      // adicionar `createdAt` ao DTO — mais um campo no payload.
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    case "prazo":
      return a.bidDeadline.getTime() - b.bidDeadline.getTime();
  }
}

// ponytail: `[...itens]` antes do `.sort()`. `Array.prototype.sort` e IN-PLACE, e
// ordenar o array que o repositorio devolveu faria o `findBySellerId` seguinte
// receber um array ja reordenado sem ele saber — o tipo classico de bug que so
// aparece quando dois consumidores aparecem na mesma tela.
export function ordenarParaVitrine(itens: ItemDaVitrine[], ordenar: OrdenacaoDaVitrine): ItemDaVitrine[] {
  return [...itens].sort((a, b) => comparar(a, b, ordenar));
}

// ponytail: a ordenacao e EM JS, e nao no SQL, por um motivo medido. A vitrine nao
// pagina (decisao de escopo), entao ela JA carrega o conjunto inteiro em memoria
// — o `ORDER BY` do banco nao evita nenhuma leitura. E o `maiorLance` e buscado de
// qualquer forma, porque o card precisa dele para mostrar o lance atual: ele ja
// vem de UMA consulta em lote, a `drizzleEstatisticasDeLances`
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
// caminho MINIMO, que e a porta que ja existe — `EstatisticasDeLances` ganhar um
// `ordenar` e devolver os ids JA ordenados (o mesmo `sort` em JS, so que dos
// ids, e o `Map` continua sendo uma unica leitura); o caminho COMPLETO e a
// listagem ganhar o `LEFT JOIN` com
// `orderBy sql`(max(bids.amount) desc nulls last)`` — o `nulls last` e
// obrigatorio, e nao enfeite: o padrao do Postgres em `DESC` e `NULLS FIRST`, que
// e o item sem lance no topo de "Maior lance" de novo. O `maisDisputados` do
// `drizzle-analise-repository.ts:99` NAO e o padrao a copiar aqui: ele resolve o
// problema oposto, porque o `having count(bids.id) > 0` DEITA fora o item sem
// lance — que na vitrine e justamente o que tem de aparecer, no fim — e o
// `desc(max(bids.amount))` dele nao tem `nulls last`. Nada alem do
// `ordenarParaVitrine` muda quando isso acontecer.
export async function listVitrine(
  itemRepo: Pick<ItemRepository, "findBySellerId">,
  lancesRepo: EstatisticasDeLances,
  sellerId: string,
  vista: VistaDaVitrine,
): Promise<ItemDaVitrine[]> {
  const filtro: ItemListFilter = { status: "active" };
  if (vista.q !== "") filtro.q = vista.q;
  const itens: Item[] = await itemRepo.findBySellerId(sellerId, filtro);
  if (itens.length === 0) return [];

  const ids = itens.map((i) => i.id);
  const estatisticas: Map<string, EstatisticasDeLance> = await lancesRepo.deVariosItens(ids);

  const dtos: ItemDaVitrine[] = itens.map((item) => {
    const stat = estatisticas.get(item.id);
    return {
      id: item.id,
      title: item.title,
      type: item.type,
      minInitialBid: item.minInitialBid,
      bidDeadline: item.bidDeadline,
      imageUrl: item.imageUrl,
      totalDeLances: stat?.total ?? 0,
      maiorLance: stat?.maior ?? null,
    };
  });

  return ordenarParaVitrine(dtos, vista.ordenar);
}