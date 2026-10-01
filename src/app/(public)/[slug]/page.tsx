import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GavelIcon } from "lucide-react";
import { getVitrineSellerAction, listVitrineItemsAction } from "@/presentation/actions/public-actions";
import { PublicItemCard } from "@/components/public-item-card";
import { EmptyState } from "@/components/empty-state";
import { ItemCardSkeleton } from "@/components/skeletons";

export const dynamic = "force-dynamic";

// ponytail: a listagem mora num COMPONENTE SEPARADO, e essa e a unica razao de
// ela existir. Uma fronteira `<Suspense>` so serve se algo ABAIXO dela suspender,
// e um `await` no corpo da propria pagina acontece antes do JSX existir — a
// fronteira, nesse caso, e decorativa: o esqueleto nunca aparece. Colocando o
// `await` dentro de um filho async, o filho e que suspende, e o fallback sai no
// primeiro flush enquanto a consulta responde.
//
// ponytail: e por isso que o `<h1>` fica FORA da fronteira, e o que a mede e o
// `page.test.tsx` desta rota (com `renderToPipeableStream`, o renderizador que o
// Next usa): uma fronteira sozinha, sem nada em volta, recebe `onShellReady` e
// NAO despeja o fallback — o React espera e entrega o conteudo pronto num unico
// flush. Com conteudo no shell (o titulo, e o `<header>` do layout publico), o
// primeiro flush leva o esqueleto e o segundo traz os cards.
async function ItensDaVitrine({
  sellerId,
  slug,
  searchParams,
}: {
  sellerId: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // ponytail: a pagina passa o `searchParams` CRU para a acao, e a acao e que
  // interpreta a URL. A leitura da URL e um contrato com DUAS portas — o
  // `searchParams` do Next (servidor) e o `URLSearchParams` do cliente — e ele
  // vive no `estado-da-vitrine.ts`; a acao e quem tem as duas, entao e ela que
  // traduz. Se a pagina interpretasse, sobraria um segundo caminho de leitura, e
  // e a duplicacao que o `estado-da-vitrine.ts` existe para matar.
  const items = await listVitrineItemsAction(sellerId, searchParams);
  // ponytail: a vitrine vazia NAO tem acao. O `EmptyState` aceita uma, e o
  // plano pedia uma acao aqui, mas o visitante de uma vitrine sem itens nao tem
  // nada a fazer: nao ha onde criar, nao ha busca e a pagina inicial e um
  // cartao de boas-vindas, nao um catalogo. Um link ali seria uma saida para
  // lugar nenhum — e o `EmptyState` sem acao e exatamente o caso que o teste de
  // componente cobre.
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhum item em leilão"
        description="Assim que ele leiloar algo, os itens aparecem aqui."
        icon={<GavelIcon aria-hidden="true" className="size-6 text-muted-foreground" />}
      />
    );
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <PublicItemCard key={item.id} item={item} slug={slug} />
      ))}
    </div>
  );
}

export default async function VitrinePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  // ponytail: o `notFound()` e do SHELL, e nao da fronteira, por causa do STATUS
  // CODE — e nao por preferencia de leitura. A documentacao do proprio Next 16
  // ("Calling `notFound()` after streaming has started", em
  // `next/dist/docs/01-app/03-api-reference/04-functions/not-found.md`) mostra o
  // outro desenho — a checagem dentro da fronteira — e nomeia a conta: "the
  // response has already begun streaming as a 200, and the status can't change
  // once streaming has started", com um `noindex` para segurar o soft 404. Esta
  // e a rota mais rastreada do produto, e um soft 404 com 200 e uma vitrine
  // inexistente e um indexavel como pagina valida; a vitrine e `force-dynamic`
  // (sem Cache Components), entao a checagem aqui ainda devolve 404 de verdade.
  const [sp, seller] = await Promise.all([searchParams, getVitrineSellerAction(slug)]);
  if (!seller) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Vitrine de {seller.name}</h1>
      <Suspense fallback={<ItemCardSkeleton />}>
        <ItensDaVitrine sellerId={seller.id} slug={slug} searchParams={sp} />
      </Suspense>
    </div>
  );
}
