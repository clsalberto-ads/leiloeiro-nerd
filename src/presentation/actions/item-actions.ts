"use server";

import { redirect } from "next/navigation";
import { getSession } from "./auth-actions";
import { formToObject, itemSchema } from "@/lib/validators";
import { createItem } from "@/application/use-cases/create-item";
import { updateItem } from "@/application/use-cases/update-item";
import { publishItem } from "@/application/use-cases/publish-item";
import { cancelItem } from "@/application/use-cases/cancel-item";
import { deleteItem } from "@/application/use-cases/delete-item";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";

export type ItemActionResult = { ok?: boolean; error?: string };

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
    return { error: err instanceof Error ? err.message : "Não foi possível criar o item. Tente novamente." };
  }
  if (ok) redirect("/dashboard/items");
  return { ok: true };
}

export async function updateItemAction(_prev: ItemActionResult | null, formData: FormData): Promise<ItemActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const id = String(formData.get("id") ?? "");
  const parsed = itemSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  let ok = false;
  try {
    await updateItem(drizzleItemRepository, session.user.id, id, parsed.data);
    ok = true;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível salvar o item. Tente novamente." };
  }
  if (ok) redirect("/dashboard/items");
  return { ok: true };
}

export async function publishItemAction(_prev: ItemActionResult | null, formData: FormData): Promise<ItemActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const id = String(formData.get("id") ?? "");
  let ok = false;
  try {
    await publishItem(drizzleItemRepository, session.user.id, id);
    ok = true;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível publicar o item." };
  }
  if (ok) redirect("/dashboard/items");
  return { ok: true };
}

export async function cancelItemAction(_prev: ItemActionResult | null, formData: FormData): Promise<ItemActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const id = String(formData.get("id") ?? "");
  let ok = false;
  try {
    await cancelItem(drizzleItemRepository, session.user.id, id);
    ok = true;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível cancelar o item." };
  }
  if (ok) redirect("/dashboard/items");
  return { ok: true };
}

export async function deleteItemAction(_prev: ItemActionResult | null, formData: FormData): Promise<ItemActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const id = String(formData.get("id") ?? "");
  let ok = false;
  try {
    await deleteItem(drizzleItemRepository, session.user.id, id);
    ok = true;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível excluir o item." };
  }
  if (ok) redirect("/dashboard/items");
  return { ok: true };
}
