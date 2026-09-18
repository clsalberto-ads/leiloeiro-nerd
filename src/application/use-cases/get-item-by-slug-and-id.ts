import type { Bid, BidRepository } from "@/domain/repositories/bid-repository";
import type { Item, ItemImage, ItemRepository } from "@/domain/repositories/item-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";

export async function getItemBySlugAndId(
  itemRepo: ItemRepository,
  userRepo: UserRepository,
  bidRepo: BidRepository,
  slug: string,
  itemId: string,
): Promise<{ item: Item; images: ItemImage[]; bids: Bid[] } | null> {
  const item = await itemRepo.findById(itemId);
  if (!item) return null;
  const user = await userRepo.findById(item.sellerId);
  if (!user || user.slug !== slug) return null;
  if (item.status !== "active") return null;
  const [images, bids] = await Promise.all([
    itemRepo.findImagesByItemId(itemId),
    bidRepo.findByItemId(itemId),
  ]);
  return { item, images, bids };
}