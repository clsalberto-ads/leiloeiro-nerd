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
  // ponytail: o mesmo gate de `draft` que `updateItem` e `deleteItem` ja fazem.
  // Esta use case conferia SO a propriedade, entao o unico obstaculo entre o
  // vendedor e as fotos de um item ja arrematado era o `disabled={locked}` do
  // botao — que e cliente, e a action e um endpoint alcançavel por POST. Num
  // item em `awaiting_payment` isso apagaria as fotos que o comprador esta
  // prestes a pagar.
  if (item.status !== "draft") throw new Error("Imagens de item publicado não podem ser excluídas");
  await itemRepo.deleteImage(imageId);
}