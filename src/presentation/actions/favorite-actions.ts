"use server";

import { getSession } from "./auth-actions";
import { drizzleFavoriteRepository } from "@/infrastructure/database/repositories/drizzle-favorite-repository";
import { toggleFavorite } from "@/application/use-cases/toggle-favorite";

export async function toggleFavoriteAction(_prev: unknown, formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return { error: "Item inválido" };
  const res = await toggleFavorite(drizzleFavoriteRepository, session.user.id, itemId);
  return { ok: true, favorited: res.favorited };
}
