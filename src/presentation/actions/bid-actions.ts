"use server";

import { getSession } from "./auth-actions";
import { formToObject, placeBidSchema } from "@/lib/validators";
import { mensagemDeErro } from "@/lib/erro-de-action";
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
    return { error: mensagemDeErro(err, "Erro ao registrar lance") };
  }
}

// ponytail: este endpoint e publico por design (a vitrine mostra os lances de um
// item ativo a qualquer visitante), mas "publico" nao pode virar "qualquer item".
// Sem o `status === "active"`, um chamador anonimo iterava UUIDs e lia o
// historico completo, COM nome do arrematante resolvido, de itens `cancelled` e
// `closed` — dados que o site nao expoe em lugar nenhum, porque a vitrine so
// lista ativos e a pagina de detalhe devolve 404 nos demais. O guard de UUID e o
// que impede o `invalid input syntax for type uuid` do Postgres de voltar
// como `err.message` para o chamador; e o `err.message` cru do catch sai junto,
// pelo mesmo motivo do `placeBidAction` acima.
export async function getItemBidsAction(_prev: BidActionResult | null, formData: FormData): Promise<BidActionResult> {
  const itemId = String(formData.get("itemId") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemId)) {
    return { error: "Item ID inválido" };
  }
  try {
    const item = await drizzleItemRepository.findById(itemId);
    if (!item || item.status !== "active") return { error: "Lances indisponíveis" };
    const bids = await getItemBids(drizzleBidRepository, drizzleUserRepository, itemId);
    return { ok: true, bids };
  } catch {
    return { error: "Erro ao buscar lances" };
  }
}