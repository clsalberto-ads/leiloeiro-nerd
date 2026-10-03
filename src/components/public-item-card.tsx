import Link from "next/link";
import type { StorefrontItem } from "@/domain/repositories/item-repository";
import { TYPE_LABELS } from "@/domain/repositories/item-repository";
import { formatBRL } from "@/lib/format-brl";
import { BidCountdown } from "@/components/bid-countdown";

export function PublicItemCard({
  item,
  slug,
  imageUrl,
}: {
  item: StorefrontItem;
  slug: string;
  imageUrl?: string | null;
}) {
  const resolvedImageUrl = imageUrl !== undefined ? imageUrl : item.imageUrl;
  const hasBid = item.highestBid !== null;

  return (
    <Link
      href={`/${slug}/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary"
    >
      {resolvedImageUrl ? (
        <div className="aspect-square w-full overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolvedImageUrl} alt={item.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        </div>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-muted text-2xl font-semibold text-muted-foreground">
          {item.title.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        {/* Região 1: Título */}
        <h3 className="line-clamp-2 font-medium leading-snug group-hover:text-primary">{item.title}</h3>

        {/* Região 2: Lance Atual (Destaque) */}
        <div className="mt-3">
          <span className="text-xs text-muted-foreground block">
            {hasBid ? "Lance atual" : "Nenhum lance ainda"}
          </span>
          <p className="text-lg font-bold text-foreground">
            R$ {formatBRL(hasBid ? item.highestBid! : item.minInitialBid)}
          </p>
        </div>

        {/* Região 3: Lance Inicial */}
        <p className="mt-1 text-xs text-muted-foreground">
          Inicial: R$ {formatBRL(item.minInitialBid)}
        </p>

        {/* Região 4: Tipo + Contagem de Lances */}
        <div className="mt-auto pt-3 flex items-center justify-between text-xs text-muted-foreground border-t">
          <span>{TYPE_LABELS[item.type]}</span>
          <span>{item.totalBids} {item.totalBids === 1 ? "lance" : "lances"}</span>
        </div>

        {/* Região 5: Urgência / Prazo */}
        <div className="mt-2 text-xs">
          <BidCountdown deadline={item.bidDeadline} />
        </div>
      </div>
    </Link>
  );
}