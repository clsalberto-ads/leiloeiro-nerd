import type { Bid, BidRepository } from "@/domain/repositories/bid-repository";
import type { Item, ItemImage, ItemRepository } from "@/domain/repositories/item-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import { resolveBidderNames } from "./get-item-bids";
import { isUuid } from "@/lib/uuid";

export async function getItemBySlugAndId(
  itemRepo: ItemRepository,
  userRepo: UserRepository,
  bidRepo: BidRepository,
  slug: string,
  itemId: string,
): Promise<{ item: Item; images: ItemImage[]; bids: Bid[] } | null> {
  // ponytail: guarda UUID no use case (única saída se o DB sq mudar para outro tipo de PK)
    // O regex vivia aqui copiado; agora é o `isUuid` de `@/lib/uuid`, o mesmo que as pages e
    // as item-actions usam — uma cópia só, para o `isUuid` não voltar por uma rota que
    // alguém crista que já estava coberta.
  if (!isUuid(itemId)) return null;
  const item = await itemRepo.findById(itemId);
  if (!item) return null;
  const user = await userRepo.findById(item.sellerId);
  if (!user || user.slug !== slug) return null;
  // ponytail: o `slug` aqui e de PRIVACIDADE, nao de "esta aberto": e o que
  // mantem `draft`/`closed` fora do alcance da vitrine e da pagina de
  // detalhe. O que falta e o sinal de "aberto", e ele NAO pode ser um segundo
  // `return null` — nada transiciona `active -> closed` (o unico `setStatus` do
  // sistema e o `cancelled`; o worker do cron e um stub), entao um item cujo
  // prazo passou continua `active` para sempre, e devolver `null` aqui faria a
  // pagina dar 404 num leilao encerrado, escondendo do comprador o lance
  // vencedor. O prazo desce ate o `BidSection`, que e quem sabe desligar o
  // formulario; `placeBid` ja recheca deadline e status (linhas 26-27 dele).
  if (item.status !== "active") return null;
  const [images, bids] = await Promise.all([
    itemRepo.findImagesByItemId(itemId),
    bidRepo.findByItemId(itemId),
  ]);
  return { item, images, bids: await resolveBidderNames(bids, userRepo) };
}