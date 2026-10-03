import type { ItemStatus, ItemType } from "./item-repository";

// ponytail: esta interface EXISTE em vez de ganhar metodos em `ItemRepository`.
// O comentario la em cima (o do `ItemLister`) avisa: existem 11 implementacoes
// de teste de `ItemRepository`, e ampliar aquele contrato custaria reescrever 11
// arquivos de teste de features sem relacao com analise. A resposta que o
// proprio codigo ja deu a esse problema foi o `ItemLister` — uma segunda
// interface, implementada por outro objeto, para o que tem outra forma de ser
// consultado. Esta e a mesma resposta para a analise.
//
// A analise tambem e a unica consulta do projeto que CRUZA `items` e `bids` (os
// lances de um item sao lidos filtrando pelo `seller_id` do item, nao pelo
// `bidder_id` do lance), o que ja a tornaria um caso diferente de qualquer
// metodo dos dois repositorios.

// Um ponto do grafico. `dia` e a data ja no fuso do app, ja formatada para
// rotulo de eixo — a query faz o agrupamento, e nao o componente.
export interface DailyPoint {
  day: string;
  total: number;
}

export interface ContestedItem {
  id: string;
  title: string;
  bids: number;
  highestBid: number;
}

export interface SellerSummary {
  totalItems: number;
  activeItems: number;
  /**
   * Soma do `minInitialBid` dos itens ATIVOS — o preco de abertura de tudo que
   * esta a leilao. O nome e `listedValue` e nao `receita` de proposito: nao ha
   * pagamento ligado no sistema (`drizzlePaymentRepository` nao tem chamador) e
   * nada marca um item como encerrado, entao nenhum valor aqui e dinheiro
   * recebido. Um `amountAtStake` (soma dos MAIORES lances) seria outro numero
   * legitimo, mas precisaria de uma subquery por item e so valeria a pena se
   * alguem decide-se por ele.
   */
  listedValue: number;
  itemsByStatus: { status: ItemStatus; total: number }[];
  itemsByType: { type: ItemType; total: number }[];
  mostContested: ContestedItem[];
}

export interface SellerSeries {
  bidsPerDay: DailyPoint[];
  itemsCreatedPerDay: DailyPoint[];
}

export interface RecentBid {
  id: string;
  itemId: string;
  itemTitle: string;
  /**
   * Slug do vendedor. A rota publica e `/[slug]/[itemId]` e o
   * `getItemBySlugAndId` RECUSA o item quando o slug nao bate — entao um link
   * `/${itemId}` (o caminho curto e obvio) daria 404. O slug vem junto da query
   * em vez de o componente descobrir depois, porque descobrir exigiria uma
   * segunda chamada por item.
   */
  sellerSlug: string | null;
  amount: number;
  createdAt: Date;
  /** `true` se ainda e o maior lance do item — ou seja, o comprador esta liderando. */
  isLeading: boolean;
}

export interface BuyerSummary {
  totalBids: number;
  watchedItems: number;
  leading: number;
  outbid: number;
  bidsPerDay: DailyPoint[];
  recent: RecentBid[];
}

export interface AnalyticsRepository {
  sellerSummary(sellerId: string): Promise<SellerSummary>;
  sellerSeries(sellerId: string, days: number): Promise<SellerSeries>;
  buyerSummary(bidderId: string, days: number): Promise<BuyerSummary>;
}
