"use server";

import { redirect } from "next/navigation";
import { getSession } from "./auth-actions";
import { formToObject, itemSchema } from "@/lib/validators";
import { toActionError } from "@/lib/action-error";
import { isUuid } from "@/lib/uuid";
import { createItem } from "@/application/use-cases/create-item";
import { updateItem } from "@/application/use-cases/update-item";
import { publishItem } from "@/application/use-cases/publish-item";
import { cancelItem } from "@/application/use-cases/cancel-item";
import { deleteItem } from "@/application/use-cases/delete-item";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";

export type ItemActionResult = { ok?: boolean; error?: string };

// ponytail: o `id` era o unico campo destas cinco actions que NAO passava pelo
// Zod (`String(formData.get("id") ?? "")`), e a coluna `items.id` e `uuid`: um
// id adulterado estourava `invalid input syntax for type uuid` do Postgres
// dentro do `findById` — antes do check de propriedade — e o `catch` devolvia
// esse texto ao navegador. Um POST feito a mao reachava isso; a UI nao. A
// mesma guarda no `publishItem` tambem evita o throw dentro do try, que hoje
// escapa da action inteira e vira erro de boundary em vez de mensagem de campo.

export async function createItemAction(_prev: ItemActionResult | null, formData: FormData): Promise<ItemActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const parsed = itemSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  let ok = false;
  try {
    await createItem(drizzleItemRepository, drizzleUserRepository, session.user.id, parsed.data);
    ok = true;
  } catch (err) {
    return { error: toActionError(err, "Não foi possível criar o item. Tente novamente.") };
  }
  if (ok) redirect("/dashboard/items");
  return { ok: true };
}

export async function updateItemAction(_prev: ItemActionResult | null, formData: FormData): Promise<ItemActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { error: "Item inválido" };
  const parsed = itemSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  let ok = false;
  try {
    await updateItem(drizzleItemRepository, session.user.id, id, parsed.data);
    ok = true;
  } catch (err) {
    return { error: toActionError(err, "Não foi possível salvar o item. Tente novamente.") };
  }
  if (ok) redirect("/dashboard/items");
  return { ok: true };
}

export async function publishItemAction(_prev: ItemActionResult | null, formData: FormData): Promise<ItemActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { error: "Item inválido" };
  let ok = false;
  try {
    await publishItem(drizzleItemRepository, session.user.id, id);
    ok = true;
  } catch (err) {
    return { error: toActionError(err, "Não foi possível publicar o item.") };
  }
  if (ok) redirect("/dashboard/items");
  return { ok: true };
}

export async function cancelItemAction(_prev: ItemActionResult | null, formData: FormData): Promise<ItemActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { error: "Item inválido" };
  let ok = false;
  try {
    await cancelItem(drizzleItemRepository, session.user.id, id);
    ok = true;
  } catch (err) {
    return { error: toActionError(err, "Não foi possível cancelar o item.") };
  }
  if (ok) redirect("/dashboard/items");
  return { ok: true };
}

export async function deleteItemAction(_prev: ItemActionResult | null, formData: FormData): Promise<ItemActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { error: "Item inválido" };
  let ok = false;
  try {
    await deleteItem(drizzleItemRepository, session.user.id, id);
    ok = true;
  } catch (err) {
    return { error: toActionError(err, "Não foi possível excluir o item.") };
  }
  if (ok) redirect("/dashboard/items");
  return { ok: true };
}
