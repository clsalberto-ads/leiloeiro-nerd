import { notFound } from "next/navigation";
import { getItemDetailAction } from "@/presentation/actions/public-actions";
import { ItemGallery } from "@/components/item-gallery";
import { BidCountdown } from "@/components/bid-countdown";
import { BidSection } from "@/components/bid-section";
import { formatBRL } from "@/lib/format-brl";
import { isUuid } from "@/lib/uuid";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({ params }: PageProps<"/[slug]/[itemId]">) {
  const { slug, itemId } = await params;
  // ponytail: o mesmo `isUuid` de `get-item-by-slug-and-id.ts`, e aqui sem nenhuma
  // consulta ainda: para `fetch`, a vitrine e publica, entao qualquer visitante
  // pode digitar `/ana/xyz` e ver um 500 em vez de um 404.
  if (!isUuid(itemId)) notFound();
  const { item, images, bids } = await getItemDetailAction(slug, itemId);
  if (!item) notFound();
  const imageUrls = images.map((i) => i.url);
  const galleryUrls = imageUrls.length ? imageUrls : item.imageUrl ? [item.imageUrl] : [];
  return (
    <div className="space-y-6 max-w-3xl">
      <ItemGallery images={galleryUrls} />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{item.title}</h1>
        <p className="text-muted-foreground">{item.description}</p>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>Lance mínimo: R$ {formatBRL(item.minInitialBid)}</span>
          <BidCountdown deadline={item.bidDeadline} />
        </div>
      </div>
      <BidSection itemId={item.id} initialBids={bids} minInitialBid={item.minInitialBid} minBidIncrement={item.minBidIncrement} deadline={item.bidDeadline} />
    </div>
  );
}