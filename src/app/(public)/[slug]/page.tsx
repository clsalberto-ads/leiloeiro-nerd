import { notFound } from "next/navigation";
import { getSellerVitrineAction } from "@/presentation/actions/public-actions";
import { PublicItemCard } from "@/components/public-item-card";

export const dynamic = "force-dynamic";

export default async function VitrinePage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const { seller, items } = await getSellerVitrineAction(slug);
  if (!seller) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Vitrine de {seller.name}</h1>
      {items.length === 0 ? <p>Nenhum item em leilão.</p> : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(item => <PublicItemCard key={item.id} item={item} slug={slug} imageUrl={item.imageUrl} />)}
        </div>
      )}
    </div>
  );
}