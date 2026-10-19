"use server";

import { getSession } from "./auth-actions";
import { drizzleFavoriteRepository } from "@/infrastructure/database/repositories/drizzle-favorite-repository";
import { toggleFavorite } from "@/application/use-cases/toggle-favorite";
import { isUuid } from "@/lib/uuid";
import { toActionError } from "@/lib/action-error";

export async function toggleFavoriteAction(_prev: unknown, formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const itemId = String(formData.get("itemId") ?? "");
  // ponytail: a mesma guarda de UUID das demais actions. Sem ela, um itemId
  // adulterado chegava ao INSERT e estourava `22P02 invalid input syntax for
  // type uuid` — e, sem try/catch, virava erro de boundary em vez de mensagem.
  if (!isUuid(itemId)) return { error: "Item inválido" };
  try {
    const res = await toggleFavorite(drizzleFavoriteRepository, session.user.id, itemId);
    return { ok: true, favorited: res.favorited };
  } catch (err) {
    return { error: toActionError(err, "Não foi possível atualizar o favorito.") };
  }
}
