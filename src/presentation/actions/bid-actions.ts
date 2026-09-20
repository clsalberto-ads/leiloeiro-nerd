"use server";

import { getSession } from "./auth-actions";
import { formToObject, placeBidSchema } from "@/lib/validators";
import { placeBid } from "@/application/use-cases/place-bid";
import { getItemBids } from "@/application/use-cases/get-item-bids";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleBidRepository } from "@/infrastructure/database/repositories/drizzle-bid-repository";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { drizzleNotificationRepository } from "@/infrastructure/database/repositories/drizzle-notification-repository";
import { createResendClient } from "@/infrastructure/email/resend";
import type { Bid } from "@/domain/repositories/bid-repository";

export type BidActionResult = { ok?: boolean; error?: string; bid?: Bid; bids?: Bid[] };

export async function placeBidAction(_prev: BidActionResult | null, formData: FormData): Promise<BidActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const parsed = placeBidSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const resend = createResendClient();
  try {
    const result = await placeBid(
      drizzleItemRepository,
      drizzleBidRepository,
      drizzleUserRepository,
      drizzleNotificationRepository,
      resend,
      session.user.id,
      parsed.data.itemId,
      parsed.data.amount,
    );
    return { ok: true, bid: result.bid };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao registrar lance" };
  }
}

export async function getItemBidsAction(_prev: BidActionResult | null, formData: FormData): Promise<BidActionResult> {
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return { error: "Item ID obrigatório" };
  try {
    const bids = await getItemBids(drizzleBidRepository, drizzleUserRepository, itemId);
    return { ok: true, bids };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao buscar lances" };
  }
}