import type { Item, ItemListFilter, ItemRepository } from "@/domain/repositories/item-repository";

export async function listSellerItems(
  itemRepo: ItemRepository,
  sellerId: string,
  filter?: ItemListFilter,
): Promise<Item[]> {
  return itemRepo.findBySellerId(sellerId, filter);
}
