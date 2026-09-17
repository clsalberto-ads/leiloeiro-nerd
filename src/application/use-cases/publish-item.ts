import type { Item, ItemRepository } from "@/domain/repositories/item-repository";

export async function publishItem(
  itemRepo: ItemRepository,
  userId: string,
  itemId: string,
): Promise<Item> {
  const existing = await itemRepo.findById(itemId);
  if (!existing) throw new Error("Item não encontrado");
  if (existing.sellerId !== userId) throw new Error("Sem permissão");
  if (existing.status !== "draft") throw new Error("Item já publicado");
  const result = await itemRepo.setStatus(itemId, "active");
  if (!result) throw new Error("Item não encontrado");
  return result;
}
