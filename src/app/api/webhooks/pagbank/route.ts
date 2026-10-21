import { isValidPagBankWebhookSignature } from "@/infrastructure/pagbank/webhook-signature";
import { getPagBankOrder } from "@/infrastructure/pagbank/orders";
import { getValidPagBankAccessToken } from "@/infrastructure/pagbank/seller-access-token";
import { drizzlePagBankSellerAccountRepository } from "@/infrastructure/database/repositories/drizzle-pagbank-seller-account-repository";
import { drizzlePaymentRepository } from "@/infrastructure/database/repositories/drizzle-payment-repository";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleNotificationRepository } from "@/infrastructure/database/repositories/drizzle-notification-repository";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const WEBHOOK_RATE_LIMIT = 100;
const WEBHOOK_RATE_WINDOW_MS = 60_000;

export async function POST(request: Request): Promise<Response> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (await isRateLimited(`pagbank-webhook:${ip}`, WEBHOOK_RATE_LIMIT, WEBHOOK_RATE_WINDOW_MS)) {
    return Response.json({ error: "Muitas requisições." }, { status: 429 });
  }

  const rawBody = await request.text();
  const secret = process.env.PAGBANK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook/pagbank] PAGBANK_WEBHOOK_SECRET ausente");
    return Response.json({ error: "Webhook não configurado." }, { status: 500 });
  }

  if (!isValidPagBankWebhookSignature({ rawBody, signatureHeader: request.headers.get("X-PagBank-Signature"), secret })) {
    return Response.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  let body: { reference_id?: string; status?: string; charges?: Array<{ status?: string }> };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return Response.json({ error: "Corpo inválido." }, { status: 400 });
  }

  // O PagBank envia reference_id (o NOSSO item.id) e status da Order
  const referenceId = body.reference_id;
  if (!referenceId) {
    return Response.json({ error: "Sem reference_id." }, { status: 200 });
  }

  const chargeStatus = body.charges?.[0]?.status ?? body.status ?? "";

  try {
    // Encontrar o pagamento pendente pelo external_reference (reference_id = item.id)
    // O PagBank já manda o reference_id — NÃO precisamos do resolvedor de vendedores!
    const payments = await drizzlePaymentRepository.findByItemId(referenceId);
    const pending = payments.find((p) => p.status === "pending");
    if (!pending) return Response.json({ received: true });

    const item = await drizzleItemRepository.findById(referenceId);
    if (!item) return Response.json({ received: true });

    // Mapa de status PagBank → nossa ação
    if (chargeStatus === "PAID") {
      const approved = await drizzlePaymentRepository.markApproved(pending.id);
      if (!approved) return Response.json({ received: true });
      await drizzleItemRepository.setStatus(referenceId, "paid");
      try {
        await drizzleNotificationRepository.create({
          userId: pending.bidderId,
          type: "payment_confirmed",
          title: "Pagamento confirmado!",
          content: `O pagamento de R$ ${(pending.amount / 100).toFixed(2).replace(".", ",")} do item "${item.title}" foi confirmado.`,
          link: `/dashboard/payments/${pending.id}`,
        });
      } catch (e) {
        console.error("[webhook/pagbank] falha ao notificar:", e);
      }
      console.log("[webhook/pagbank]", referenceId, "→ PAID");
    } else if (chargeStatus === "CANCELED" || chargeStatus === "DECLINED") {
      const cancelled = await drizzlePaymentRepository.markCancelled(pending.id);
      if (!cancelled) return Response.json({ received: true });
      console.log("[webhook/pagbank]", referenceId, "→", chargeStatus);
    }
    // IN_ANALYSIS, PENDING → no-op (a cascata é do cron verificar-prazos)

    return Response.json({ received: true });
  } catch (err) {
    console.error("[webhook/pagbank] falha ao processar:", err);
    return Response.json({ error: "Falha ao processar." }, { status: 500 });
  }
}
