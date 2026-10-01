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
// nao e "a regra do projeto proibe" — NAO existe essa regra, e tres paginas do
// dashboard (`dashboard/page.tsx`, `items/page.tsx`, `items/[id]/edit/page.tsx`)
// importam `drizzleItemRepository` direto desde antes deste trabalho. A razao real e
// o TESTE: `page.test.tsx` e um dos testes protegidos e ele faz `vi.mock` de
// `@/presentation/actions/public-actions`; se a pagina chamasse `listVitrine`
// direto, o mock nao interceptaria nada e o teste passaria a abrir conexao real
// com o Postgres. A action e a costura que o teste ja fixa, e o `page.tsx` novo
// continua nela. Um dia em que esse arquivo puder mudar, a decisao volta a ser da
// arquitetura e nao do mock.
//
// ponytail: a leitura da URL acontece AQUI, e nao na pagina, pelo mesmo motivo do
// `estado-da-vitrine.ts`: o contrato tem DUAS portas (o `searchParams` do Next e o
// `URLSearchParams` do cliente) e a action e a unica camada que tem as duas. Se a
// pagina interpretasse, sobraria um segundo caminho de leitura.
//
// ponytail: `drizzleEstatisticasDeLances` e NAO `drizzleBidRepository`. Sao duas
// portas diferentes de proposito: `BidRepository` GRAVA lances (`placeBid`) e a
// vitrine so LE um agregado. Passar o repositorio inteiro aqui da certo por
// acaso hoje e quebra no dia em que os fakes de `placeBid` receberem um metodo a
// implementar — e foi o `tsc` que avisou.
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