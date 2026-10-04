export interface Bid {
  id: string;
  itemId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  rank: number | null;
  createdAt: Date;
}

/**
 * `Bid` sem o `bidderId`: a forma que pode ATRAVESSAR a fronteira
 * server -> client.
 *
 * ponytail: `bid-section.tsx` e `bid-history.tsx` sao `"use client"` e recebem
 * a lista de lances como prop, entao cada `bidderId` e serializado no payload do
 * RSC e fica no IndexedDB/React DevTools de qualquer visitante da vitrine. Nenhum
 * componente do cliente USA o campo — e o `bidderName` sozinho ja resolve o que
 * a tela precisa mostrar. Um conserto anterior trocou o UUID visivel por nome mas
 * deixou o campo no objeto, que e o vazamento de verdade: o id interno do
 * arrematante nao tem nada de util na vitrine e permite correlacionar a mesma
 * pessoa entre itens. Por isso o DTO e um tipo, e nao um `delete` no mapper: o
 * `Bid` completo continua existindo para o servidor (notificacoes, e-mail).
 */
export type BidView = Omit<Bid, "bidderId">;

export interface CreateBidInput {
  itemId: string;
  bidderId: string;
  amount: number;
}

export interface LockedBidItem {
  id: string;
  title: string;
  sellerId: string;
  status: string;
  bidDeadline: Date;
  minInitialBid: number;
  minBidIncrement: number;
}

export interface BidPlacement {
  bid: Bid;
  previousHighestBid: Bid | null;
}

export interface BidRepository {
  findByItemId(itemId: string): Promise<Bid[]>;
  placeBid(
    input: CreateBidInput,
    validate: (ctx: { item: LockedBidItem | null; highestBid: Bid | undefined }) => void,
  ): Promise<BidPlacement>;
  listByBidder(bidderId: string, limit?: number, offset?: number): Promise<Bid[]>;
}

// ponytail: o agregado que a vitrine precisa, e NAO mais um metodo em
// `BidRepository`. `BidRepository` tem metodos que GRAVAM (`placeBid`); a
// vitrine so LE um agregado. A porta separada deixa isso explicito e — o que
// importa no curto prazo — os fakes de `BidRepository` nos testes de `placeBid`
// nao recebem um metodo a implementar. E o mesmo motivo do `ItemLister` em
// `item-repository.ts:188-200`.
//
// ponytail: o cancelamento de lance esta previsto na spec e AINDA NAO EXISTE
// aqui. Quando ele entrar (`cancelBidByItem`), `bids` ganha a semantica de "lance
// cancelado" e este agregado passa a contar lance cancelado como se fosse lance —
// sem erro de tipo e sem teste vermelho, porque o `SELECT` deste arquivo traz
// TODOS os lances do item.
//
// E por isso que o cancelamento tem de entrar NESTA consulta, e nao numa
// filtragem depois: um `WHERE` no mesmo SELECT ja exclui a linha antes do
// `GROUP BY` contar, enquanto um filtro aplicado sobre o `Map` em JS contaria
// primeiro e descartaria depois — e o numero que a vitrine mostra ja estaria
// errado antes de qualquer comparacao. Nao e "filtro do SELECT e nao do GROUP BY"
// (que sao a mesma query): e "filtro antes do agregado, e nao depois".
export interface BidStats {
  total: number;
  highestBid: number | null;
}

// ponytail: AUSENCIA no `Map` e o "sem lance": so entra item que apareceu no
// `GROUP BY`, e nao uma linha de zero para todo item pedido. E por isso que
// `highestBid` e `number | null` e nao `number` — o card da vitrine le `mapa.get(id)`
// e usa a ausencia para escrever "ainda ninguem deu lance", que nao e a mesma
// coisa que um maior lance de R$ 0.
export interface BidStatsList {
  // ponytail: `ids` vazio devolve `Map` vazio SEM tocar no banco. A vitrine sem
  // itens nao deve abrir uma consulta so para receber zero linhas.
  ofManyItems(itemIds: string[]): Promise<Map<string, BidStats>>;
}