import { getSession } from "@/presentation/actions/auth-actions";
import Link from "next/link";
import { listSellerItems } from "@/application/use-cases/list-seller-items";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import type { ItemStatus } from "@/domain/repositories/item-repository";
import { ItemsList } from "./items-list";
import { BecomeSellerForm } from "@/components/become-seller-form";

const VALID_STATUSES: ItemStatus[] = ["draft", "active", "closed", "awaiting_payment", "paid", "cancelled"];

export const dynamic = "force-dynamic";

export default async function ItemsPage({ searchParams }: PageProps<"/dashboard/items">) {
  const session = await getSession();
  if (!session) return null;
  const isSeller = session.user.role === "seller" || session.user.role === "both";
  const { status } = await searchParams;
  const filterStatus = typeof status === "string" && VALID_STATUSES.includes(status as ItemStatus)
    ? (status as ItemStatus)
    : undefined;
  const { items } = isSeller
    ? await listSellerItems(drizzleItemRepository, session.user.id, filterStatus ? { status: filterStatus } : undefined)
    : { items: [] };

  if (!isSeller) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Meus itens</h1>
        <p className="text-muted-foreground">Você ainda não é leiloeiro.</p>
        <BecomeSellerForm />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meus itens</h1>
        <Link href="/dashboard/items/new" className="text-sm font-medium text-primary underline">+ Novo item</Link>
      </div>
      <ItemsList items={items} current={typeof status === "string" && VALID_STATUSES.includes(status as ItemStatus) ? status : "all"} />
    </div>
  );
}