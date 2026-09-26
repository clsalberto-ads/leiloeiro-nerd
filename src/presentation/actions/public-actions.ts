"use server";

import { getSellerBySlug } from "@/application/use-cases/get-seller-by-slug";
import { listActiveItemsBySellerId } from "@/application/use-cases/list-active-items-by-seller";
import { getItemBySlugAndId } from "@/application/use-cases/get-item-by-slug-and-id";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleBidRepository } from "@/infrastructure/database/repositories/drizzle-bid-repository";

export async function getVitrineSellerAction(slug: string) {
  return getSellerBySlug(drizzleUserRepository, slug);
}

export async function listVitrineItemsAction(sellerId: string) {
  return listActiveItemsBySellerId(drizzleItemRepository, sellerId);
}

// ponytail: a vitrine (`app/(public)/[slug]/page.tsx`) nao usa mais ESTA acao — ela
// pede o cabecalho e a lista nas duas acoes acima, porque a listagem e a que fica
// dentro da fronteira `<Suspense>` e o cabecalho e o que fica fora: o
// `notFound()` precisa do vendedor ANTES do primeiro flush, senao um slug
// inexistente responderia 200 depois que a resposta ja saiu. As duas acoes acima
// sao as pecas das quais esta e feita, e ela continua aqui porque o seu contrato
// (`{ seller, items }`, e a lista vazia sem consultar itens quando o slug nao
// existe) esta fixado em `public-actions.test.ts` — que nao pode ser reescrito.
//
// ponytail: o `getSellerBySlug` aparecer nas duas acoes acima nao e cache nem
// reescrita. Sao leituras de momentos distintos: o shell precisa do nome para
// montar o `<h1>` antes de a fronteira existir, e so depois que a vitrine e
// authentica a listagem vale a consulta. Unificar as duas voltaria a trazer a
// listagem para dentro do shell, que e exatamente o que a fronteira existe para
// nao fazer.
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