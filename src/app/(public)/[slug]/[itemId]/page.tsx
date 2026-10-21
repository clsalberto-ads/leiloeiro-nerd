import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRightIcon, StoreIcon } from "lucide-react";
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
    <div className="mx-auto w-full max-w-5xl space-y-4">
      {/* ponytail (R3.3): breadcrumb — o caminho de VOLTA à vitrine. Sem ele o
          visitante que chega num item por link compartilhado fica preso: o
          único link de saída era o logo, que vai para a HOME, não para a
          vitrine de onde o item veio. A home da vitrine é o destino natural. */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href={`/${slug}`}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <StoreIcon aria-hidden="true" className="size-4" />
          Vitrine
        </Link>
        <ChevronRightIcon aria-hidden="true" className="size-3.5" />
        <span className="font-medium text-foreground" aria-current="page">
          {item.title}
        </span>
      </nav>

      {/* Uma coluna no mobile, duas no desktop (md+). A galeria fica à esquerda e
          os detalhes/lance à direita. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        <div className="self-start md:sticky md:top-24">
          <ItemGallery images={galleryUrls} />
        </div>

        <div className="space-y-4">
          <h1 className="text-2xl font-bold md:text-3xl">{item.title}</h1>
          <p className="text-muted-foreground">{item.description}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span>Lance mínimo: R$ {formatBRL(item.minInitialBid)}</span>
            <BidCountdown deadline={item.bidDeadline} />
          </div>
          <BidSection
            itemId={item.id}
            initialBids={bids}
            minInitialBid={item.minInitialBid}
            minBidIncrement={item.minBidIncrement}
            deadline={item.bidDeadline}
          />
        </div>
      </div>
    </div>
  );
}
