import type { ItemImage, ItemRepository } from "@/domain/repositories/item-repository";

export async function createItemImages(
  itemRepo: ItemRepository,
  itemId: string,
  urls: string[],
): Promise<ItemImage[]> {
  return itemRepo.createImages(itemId, urls);
}