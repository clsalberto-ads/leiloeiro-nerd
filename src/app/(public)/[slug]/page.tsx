import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GavelIcon } from "lucide-react";
import { getVitrineSellerAction } from "@/presentation/actions/public-actions";
import { PublicItemCard } from "@/components/public-item-card";
import { EmptyState } from "@/components/empty-state";
import { ItemCardSkeleton } from "@/components/skeletons";
import { interpretarVitrine } from "./estado-da-vitrine";
import { listVitrine } from "@/application/use-cases/list-vitrine";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleBidRepository } from "@/infrastructure/database/repositories/drizzle-bid-repository";
import { primeiroValor } from "@/lib/primeiro-valor";

export const dynamic = "force-dynamic";

async function ItensDaVitrine({
  sellerId,
  slug,
  searchParams,
}: {
  sellerId: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const vista = interpretarVitrine((nome) => primeiroValor(searchParams[nome]));
  const items = await listVitrine(drizzleItemRepository, drizzleBidRepository, sellerId, vista);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhum item encontrado"
        description="Assim que houver novos itens ou termos correspondentes, eles aparecerão aqui."
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
  const sp = await searchParams;
  const seller = await getVitrineSellerAction(slug);
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

