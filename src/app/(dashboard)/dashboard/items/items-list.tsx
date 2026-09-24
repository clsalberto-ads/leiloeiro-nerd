import Link from "next/link";
import type { Item } from "@/domain/repositories/item-repository";
import { ItemStatusBadge } from "@/components/item-status-badge";
import { BidCountdown } from "@/components/bid-countdown";
import { formatReais } from "@/lib/format-reais";
import { cancelItemAction, deleteItemAction, publishItemAction } from "@/presentation/actions/item-actions";

type ItemFormAction = (formData: FormData) => void | Promise<void>;
const publishItemFormAction: ItemFormAction = publishItemAction.bind(null, null) as unknown as ItemFormAction;
const deleteItemFormAction: ItemFormAction = deleteItemAction.bind(null, null) as unknown as ItemFormAction;
const cancelItemFormAction: ItemFormAction = cancelItemAction.bind(null, null) as unknown as ItemFormAction;

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "draft", label: "Rascunho" },
  { key: "active", label: "Em leilão" },
  { key: "closed", label: "Encerrado" },
  { key: "cancelled", label: "Cancelado" },
];

export function ItemsList({ items, current }: { items: Item[]; current: string }) {
  const visible = current === "all" || current === "" ? items : items.filter((i) => i.status === current);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/dashboard/items" : `/dashboard/items?status=${tab.key}`}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              current === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground">Nenhum item neste status.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li key={item.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">Lance mínimo: R$ {formatReais(item.minInitialBid)}</p>
                </div>
                <ItemStatusBadge status={item.status} />
              </div>
              {item.status === "active" ? <BidCountdown deadline={item.bidDeadline} /> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {item.status === "draft" ? (
                  <>
                    <Link href={`/dashboard/items/${item.id}/edit`} className="text-sm font-medium text-primary underline">Editar</Link>
                    <form action={publishItemFormAction}><input type="hidden" name="id" value={item.id} /><button type="submit" className="text-sm font-medium text-emerald-600 underline">Publicar</button></form>
                    <form action={deleteItemFormAction}><input type="hidden" name="id" value={item.id} /><button type="submit" className="text-sm font-medium text-destructive underline">Excluir</button></form>
                  </>
                ) : null}
                {item.status === "active" || item.status === "closed" ? (
                  <form action={cancelItemFormAction}><input type="hidden" name="id" value={item.id} /><button type="submit" className="text-sm font-medium text-destructive underline">Cancelar</button></form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}