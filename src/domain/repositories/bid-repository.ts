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
// `BidRepository`. `BidRepository` tem metodos que GRAVAM (`placeBid`,
// `cancelBidByItem`); a vitrine so le um agregado. A porta separada deixa isso
// explicito e — o que importa no curto prazo — os fakes de `BidRepository` nos
// testes de `placeBid` nao recebem um metodo a implementar. E o mesmo motivo do
// `ItemLister` em `item-repository.ts:188-200`.
export interface EstatisticasDeLance {
  total: number;
  maior: number | null;
}

export interface EstatisticasDeLances {
  // ponytail: `ids` vazio devolve `Map` vazio SEM tocar no banco. A vitrine sem
  // itens nao deve abrir uma consulta so para receber zero linhas.
  deVariosItens(itemIds: string[]): Promise<Map<string, EstatisticasDeLance>>;
}