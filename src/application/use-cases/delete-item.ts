import type { ItemRepository } from "@/domain/repositories/item-repository";

export async function deleteItem(
  itemRepo: ItemRepository,
  userId: string,
  itemId: string,
): Promise<void> {
  const existing = await itemRepo.findById(itemId);
  if (!existing) throw new Error("Item não encontrado");
  if (existing.sellerId !== userId) throw new Error("Sem permissão");
  if (existing.status !== "draft") throw new Error("Apenas itens em rascunho podem ser excluídos");
  const bids = await itemRepo.countBids(itemId);
  if (bids > 0) throw new Error("Item com lances não pode ser excluído");
  await itemRepo.delete(itemId);
}
