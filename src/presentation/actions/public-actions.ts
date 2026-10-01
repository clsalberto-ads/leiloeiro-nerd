"use server";

import { getSellerBySlug } from "@/application/use-cases/get-seller-by-slug";
import { listActiveItemsBySellerId } from "@/application/use-cases/list-active-items-by-seller";
import { getItemBySlugAndId } from "@/application/use-cases/get-item-by-slug-and-id";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleBidRepository, drizzleEstatisticasDeLances } from "@/infrastructure/database/repositories/drizzle-bid-repository";
import { listVitrine } from "@/application/use-cases/list-vitrine";
import { interpretarVitrine } from "@/app/(public)/[slug]/estado-da-vitrine";
import { primeiroValor } from "@/lib/primeiro-valor";

export async function getVitrineSellerAction(slug: string) {
  return getSellerBySlug(drizzleUserRepository, slug);
}

// ponytail: a vitrine passa pela ACTION e nao pelo `listVitrine` direto, e o motivo
// e a seta: a pagina e um Server Component de `src/app`, e a regra do projeto e que
// `src/app` nao importa `src/infrastructure` (Drizzle) nem `src/application`
// diretamente — a costura e a acao. E a leitura da URL acontece AQUI, e nao na
// pagina, porque o `estado-da-vitrine.ts` e um contrato com DUAS portas (o
// `searchParams` do Next e o `URLSearchParams` do cliente) e esta e a unica camada
// que tem as duas.
//
// ponytail: `drizzleEstatisticasDeLances` e NAO `drizzleBidRepository`. Sao duas
// portas diferentes de proposito: `BidRepository` GRAVA lances (`placeBid`) e a
// vitrine so LE um agregado. Passar o repositorio inteiro aqui da certo por
// acaso hoje e quebra no dia em que os fakes de `placeBid` receberem um metodo a
// implementar — e o `tsc` e quem avisa, que e o que aconteceu.
export async function listVitrineItemsAction(
  sellerId: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const vista = interpretarVitrine((nome) => primeiroValor(searchParams[nome]));
  return listVitrine(drizzleItemRepository, drizzleEstatisticasDeLances, sellerId, vista);
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