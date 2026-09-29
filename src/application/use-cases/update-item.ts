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
  // ponytail: as MESMAS duas regras que o `createItem` recheca (linhas 17-22
  // dele), e nao regras novas. `itemSchema` ja cobre isto no unico caminho de
  // escrita de hoje, entao nao ha exploit vivo — mas o `createItem` existe
  // justamente para nao confiar no schema, e um `updateItem` sem o par nao
  // teria como ser a segunda porta da mesma regra: o proximo caller (uma
  // action de revenda, um import) herdaria o buraco.
  // `UpdateItemInput` e uma atualizacao PARCIAL (tudo opcional), entao cada
  // regra so e checada quando o campo veio no patch — o `undefined` de
  // "nao mexer neste campo" nao pode ser lido como "campo invalido".
  if (input.bidDeadline !== undefined && input.bidDeadline.getTime() <= Date.now()) {
    throw new Error("Prazo de lances deve ser no futuro");
  }
  if (
    (input.minInitialBid !== undefined && input.minInitialBid < 100) ||
    (input.minBidIncrement !== undefined && input.minBidIncrement < 100)
  ) {
    throw new Error("Lance mínimo deve ser de pelo menos R$ 1,00");
  }
  const result = await itemRepo.update(itemId, input);
  if (!result) throw new Error("Item não encontrado");
  if (input.imageUrls?.length) {
    await createItemImages(itemRepo, itemId, input.imageUrls);
  }
  return result;
}