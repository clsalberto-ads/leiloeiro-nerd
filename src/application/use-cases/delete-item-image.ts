import type { ItemRepository } from "@/domain/repositories/item-repository";

export async function deleteItemImage(
  itemRepo: ItemRepository,
  userId: string,
  imageId: string,
): Promise<void> {
  const image = await itemRepo.findImageById(imageId);
  if (!image) throw new Error("Imagem não encontrada");
  const item = await itemRepo.findById(image.itemId);
  if (!item || item.sellerId !== userId) throw new Error("Sem permissão");
  await itemRepo.deleteImage(imageId);
}