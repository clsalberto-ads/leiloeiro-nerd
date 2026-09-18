import Link from "next/link";
import type { Item } from "@/domain/repositories/item-repository";

export function PublicItemCard({
  item,
  slug,
  imageUrl,
}: {
  item: Item;
  slug: string;
  imageUrl?: string | null;
}) {
  return (
    <Link
      href={`/${slug}/${item.id}`}
      className="group block overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary"
    >
      {imageUrl ? (
        <div className="aspect-square w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-muted text-2xl font-semibold text-muted-foreground">
          {item.title.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="p-3">
        <h3 className="line-clamp-2 font-medium">{item.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Lance mínimo: R$ {(item.minInitialBid / 100).toFixed(2)}</p>
      </div>
    </Link>
  );
}