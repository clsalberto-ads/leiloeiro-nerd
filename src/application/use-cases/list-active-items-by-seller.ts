import type { Item, ItemRepository } from "@/domain/repositories/item-repository";

export async function listActiveItemsBySellerId(
  itemRepo: ItemRepository,
  sellerId: string,
): Promise<Item[]> {
  return itemRepo.findBySellerId(sellerId, { status: "active" });
}