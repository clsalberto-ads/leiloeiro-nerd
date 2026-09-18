import type { ItemRepository } from "@/domain/repositories/item-repository";

// ponytail: sem checagem de ownership — requer findImageById no ItemRepository.
// hoje a exclusão é guardada pela sessão na server action (Task 5/9); validação em
// profundidade fica para uma Future task quando houver método de lookup por imagem.
export async function deleteItemImage(
  itemRepo: ItemRepository,
  _sellerId: string,
  imageId: string,
): Promise<void> {
  await itemRepo.deleteImage(imageId);
}