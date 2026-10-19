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
  // mantem `draft`/`closed`/`cancelled` fora do alcance da vitrine e da pagina
  // de detalhe. A transicao `active -> closed` EXISTE — o worker do cron roda
  // `closeExpiredItems` (via `itemRepo.closeExpired`) e encerra os itens vencidos
  // a cada minuto — entao um item cujo prazo passou logo vira `closed` e a
  // pagina passa a devolver 404. O prazo que vence COM a pagina aberta (antes do
  // proximo tick do worker) ainda desce ate o `BidSection`, que sabe desligar o
  // formulario; `placeBid` recheca deadline e status do seu lado.
  if (item.status !== "active") return null;
  const [images, bids] = await Promise.all([
    itemRepo.findImagesByItemId(itemId),
    bidRepo.findByItemId(itemId),
  ]);
  return { item, images, bids: await resolveBidderNames(bids, userRepo) };
}