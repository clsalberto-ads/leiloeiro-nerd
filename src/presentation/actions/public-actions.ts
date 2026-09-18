"use server";

import { getSellerBySlug } from "@/application/use-cases/get-seller-by-slug";
import { listActiveItemsBySellerId } from "@/application/use-cases/list-active-items-by-seller";
import { getItemBySlugAndId } from "@/application/use-cases/get-item-by-slug-and-id";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleBidRepository } from "@/infrastructure/database/repositories/drizzle-bid-repository";

export async function getSellerVitrineAction(slug: string) {
  const seller = await getSellerBySlug(drizzleUserRepository, slug);
  if (!seller) return { seller: null, items: [] };
  const items = await listActiveItemsBySellerId(drizzleItemRepository, seller.id);
  return { seller, items };
}

export async function getItemDetailAction(slug: string, itemId: string) {
  const result = await getItemBySlugAndId(
    drizzleItemRepository,
    drizzleUserRepository,
    drizzleBidRepository,
    slug,
    itemId,
  );
  if (!result) return { item: null, images: [], bids: [] };
  return { item: result.item, images: result.images, bids: result.bids };
}