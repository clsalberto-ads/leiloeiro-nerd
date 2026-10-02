import { notFound } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { ItemForm } from "@/components/item-form";
import { PageHeader } from "@/components/layout/page-header";
import { isUuid } from "@/lib/uuid";

export const dynamic = "force-dynamic";

export default async function EditItemPage({ params }: PageProps<"/dashboard/items/[id]/edit">) {
  const [session, { id }] = await Promise.all([getSession(), params]);
  if (!session) return null;
  // ponytail: `isUuid` e `notFound()`, e o id vem do PATH. Sem esta guarda, um
  // `/itens/abc` digitado na mao estourava
  // `22003` do Postgres sem nenhum catch no
  // meio — 500, que afirma "a aplicacao quebrou" para o que e so um endereco
  // que nao existe. `notFound()` e a resposta certa para os dois casos.
  if (!isUuid(id)) notFound();
  const item = await drizzleItemRepository.findById(id);
  if (!item || item.sellerId !== session.user.id) notFound();
  return (
    <div className="space-y-4">
      <PageHeader title="Editar item" />
      <ItemForm item={item} mode="edit" />
    </div>
  );
}
