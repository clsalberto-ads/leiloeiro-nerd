import type { Item, ItemRepository, UpdateItemInput } from "@/domain/repositories/item-repository";
import { createItemImages } from "./create-item-images";

export async function updateItem(
  itemRepo: ItemRepository,
  userId: string,
  itemId: string,
  input: UpdateItemInput,
): Promise<Item> {
  const existing = await itemRepo.findById(itemId);
  if (!existing) throw new Error("Item não encontrado");
  if (existing.sellerId !== userId) throw new Error("Sem permissão");
  if (existing.status !== "draft") throw new Error("Item publicado não pode ser editado");
  const bids = await itemRepo.countBids(itemId);
  if (bids > 0) throw new Error("Item com lances não pode ser editado");
  const result = await itemRepo.update(itemId, input);
  if (!result) throw new Error("Item não encontrado");
  if (input.imageUrls?.length) {
    await createItemImages(itemRepo, itemId, input.imageUrls);
  }
  return result;
}