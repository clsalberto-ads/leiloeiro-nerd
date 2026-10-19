import type { BidRepository, Bid } from "@/domain/repositories/bid-repository";
import type { Item, ItemBatchFinder } from "@/domain/repositories/item-repository";

export interface MyBidRow {
  bid: Bid;
  item: Item | null;
}

// ponytail: UMA consulta para todos os itens dos lances, e não uma por lance. O
// `findById` em `Promise.all` parecia concorrente, mas continuava sendo N idas
// ao banco contra o pool de conexões. `findByIds` (mesmo padrão do
// `UserRepository.findByIds`) resolve o lote; `ids` vazio não toca no banco.
export async function listMyBids(
  bidRepo: BidRepository,
  itemRepo: ItemBatchFinder,
  bidderId: string,
  limit = 50,
): Promise<MyBidRow[]> {
  const bids = await bidRepo.listByBidder(bidderId, limit);
  if (bids.length === 0) return [];

  const ids = [...new Set(bids.map((bid) => bid.itemId))];
  const items = await itemRepo.findByIds(ids);
  const itemById = new Map(items.map((item) => [item.id, item]));

  return bids.map((bid) => ({ bid, item: itemById.get(bid.itemId) ?? null }));
}
