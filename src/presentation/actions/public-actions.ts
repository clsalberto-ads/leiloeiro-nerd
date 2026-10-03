"use server";

import { getSellerBySlug } from "@/application/use-cases/get-seller-by-slug";
import { getStorefrontSeller } from "@/application/use-cases/get-storefront-seller";
import { listActiveItemsBySellerId } from "@/application/use-cases/list-active-items-by-seller";
import { getItemBySlugAndId } from "@/application/use-cases/get-item-by-slug-and-id";
import { drizzleUserRepository, drizzleSellerStorefrontRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleBidRepository, drizzleBidStatsList } from "@/infrastructure/database/repositories/drizzle-bid-repository";
import { listStorefront } from "@/application/use-cases/list-storefront";
import type { StorefrontItem } from "@/domain/repositories/item-repository";
import type { SellerStorefront } from "@/domain/repositories/user-repository";
import type { StorefrontView } from "@/app/(public)/[slug]/storefront-state";

// ponytail: o vendedor vem da porta de VITRINE (`drizzleSellerStorefrontRepository`)
// e nao de `getSellerBySlug`. Sao dois use cases com contratos diferentes: o
// primeiro devolve `{id, name, slug}` e o segundo devolve o perfil do hero
// (avatar, membro desde, itens ativos). Trocar um pelo outro faria o hero
// renderizar `undefined` em tres campos — e o `tsc` nao acusa, porque `undefined`
// casa com `string | null` e com `Date` narrowed no `toLocaleDateString`.
export async function getStorefrontSellerAction(slug: string): Promise<SellerStorefront | null> {
  return getStorefrontSeller(drizzleSellerStorefrontRepository, slug);
}

// ponytail: a action recebe a VISTA inteira, e nao o `searchParams` cru. Quem
// interpreta a URL e o SHELL (`page.tsx`), e nao a action: a `vista` e o estado que
// a tela esta mostrando, e e ela que o `<form>`, os `<Link>` de ordenacao e a lista
// usam — se a action interpretasse, a pagina teria uma `vista` e a action outra, e
// o "o que a tela mostra" e o "o que a lista filtra" deixariam de ser o mesmo
// objeto por construcao. A leitura da URL tem uma porta so
// (`parseStorefrontView`), e ela fica no shell.
//
// ponytail: `drizzleBidStatsList` e NAO `drizzleBidRepository`. Sao duas
// portas diferentes de proposito: `BidRepository` GRAVA lances (`placeBid`) e a
// vitrine so LE um agregado. Passar o repositorio inteiro aqui da certo por
// acaso hoje e quebra no dia em que os fakes de `placeBid` receberem um metodo a
// implementar — e foi o `tsc` que avisou.
export async function listStorefrontItemsAction(
  sellerId: string,
  view: StorefrontView,
): Promise<StorefrontItem[]> {
  return listStorefront(drizzleItemRepository, drizzleBidStatsList, sellerId, view);
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