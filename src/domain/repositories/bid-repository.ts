export interface Bid {
  id: string;
  itemId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  rank: number | null;
  createdAt: Date;
}

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
// sem erro de tipo e sem teste vermelho, porque o filtro e do `SELECT` e nao
// deste arquivo. E o por de o cancelamento vir com um filtro do proprio `SELECT`,
// e nao do `GROUP BY`.
export interface EstatisticasDeLance {
  total: number;
  maior: number | null;
}

// ponytail: AUSENCIA no `Map` e o "sem lance": so entra item que apareceu no
// `GROUP BY`, e nao uma linha de zero para todo item pedido. E por isso que
// `maior` e `number | null` e nao `number` — o card da vitrine le `mapa.get(id)`
// e usa a ausencia para escrever "ainda ninguem deu lance", que nao e a mesma
// coisa que um maior lance de R$ 0.
export interface EstatisticasDeLances {
  // ponytail: `ids` vazio devolve `Map` vazio SEM tocar no banco. A vitrine sem
  // itens nao deve abrir uma consulta so para receber zero linhas.
  deVariosItens(itemIds: string[]): Promise<Map<string, EstatisticasDeLance>>;
}