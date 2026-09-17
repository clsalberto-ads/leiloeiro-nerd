import type { Item, ItemRepository } from "@/domain/repositories/item-repository";

const CANCELABLE = new Set(["active", "closed"]);

export async function cancelItem(
  itemRepo: ItemRepository,
  userId: string,
  itemId: string,
): Promise<Item> {
  const existing = await itemRepo.findById(itemId);
  if (!existing) throw new Error("Item não encontrado");
  if (existing.sellerId !== userId) throw new Error("Sem permissão");
  if (!CANCELABLE.has(existing.status)) throw new Error("Item não pode ser cancelado neste status");
  const result = await itemRepo.setStatus(itemId, "cancelled");
  if (!result) throw new Error("Item não encontrado");
  return result;
}
