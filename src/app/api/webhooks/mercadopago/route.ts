import { isValidMpWebhookSignature } from "@/infrastructure/mercado-pago/webhook-signature";
import { getMpPayment } from "@/infrastructure/mercado-pago/payments";
import { getValidSellerAccessToken } from "@/infrastructure/mercado-pago/seller-access-token";
import { handlePaymentWebhook } from "@/application/use-cases/handle-payment-webhook";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzlePaymentRepository } from "@/infrastructure/database/repositories/drizzle-payment-repository";
import { drizzleNotificationRepository } from "@/infrastructure/database/repositories/drizzle-notification-repository";
import { drizzleMpSellerAccountRepository } from "@/infrastructure/database/repositories/drizzle-mp-seller-account-repository";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { createResendClient } from "@/infrastructure/email/resend";
import { isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// ponytail: rate limit do webhook (spec §3.7: 100 req/min por IP). A MP
// reenvia com backoff — 100/min é folga para o retry deles e teto curto para
// qualquer martelada. O mesmo limitador deslizante do /api/chat; recusas não
// estendem a janela.
const WEBHOOK_RATE_LIMIT = 100;
const WEBHOOK_RATE_WINDOW_MS = 60_000;

// ponytail: o webhook é a ÚNICA entrada da MP no sistema — pública, assinada
// e idempotente. A ordem dos filtros importa:
//   1. assinatura ANTES de qualquer processamento (401: sem ela, qualquer um
//      poderia "aprovar" pagamentos com um POST forjado);
//   2. tipos que não são de pagamento respondem 200 e são descartados — a MP
//      reenvia eternamente o que não recebe 2xx;
//   3. falha TRANSIENTE (rede, banco) sobe como 500 — a MP tenta de novo.
//      Pagamento inexistente/ignorado é 200: sucesso de PROTOCOLO, e o
//      reprocessamento não vai mudar o resultado (idempotência do use case).
export async function POST(request: Request): Promise<Response> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (isRateLimited(`mp-webhook:${ip}`, WEBHOOK_RATE_LIMIT, WEBHOOK_RATE_WINDOW_MS)) {
    return Response.json({ error: "Muitas requisições." }, { status: 429 });
  }

  const rawBody = await request.text();

  let body: { type?: unknown; data?: { id?: unknown } };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return Response.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const dataId = body.data?.id;
  if (typeof dataId !== "string" && typeof dataId !== "number") {
    return Response.json({ error: "Sem id de pagamento." }, { status: 400 });
  }

  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook/mp] MERCADO_PAGO_WEBHOOK_SECRET ausente");
    return Response.json({ error: "Webhook não configurado." }, { status: 500 });
  }

  const valid = isValidMpWebhookSignature({
    header: request.headers.get("x-signature"),
    rawBody,
    dataId: String(dataId),
    secret,
  });
  if (!valid) {
    return Response.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  if (body.type !== "payment") {
    // Outros webhooks da MP (topic, etc.): reconhecidos e descartados.
    return Response.json({ received: true });
  }

  try {
    const outcome = await handlePaymentWebhook(
      {
        paymentRepo: drizzlePaymentRepository,
        itemRepo: drizzleItemRepository,
        notifRepo: drizzleNotificationRepository,
        getAccessToken: (userId) =>
          getValidSellerAccessToken(drizzleMpSellerAccountRepository, userId),
        fetchStatus: { fetchMpPaymentStatus: getMpPayment },
        resend: process.env.RESEND_API_KEY ? createResendClient() : null,
        userRepo: drizzleUserRepository,
      },
      String(dataId),
    );
    console.log("[webhook/mp]", String(dataId), "→", outcome.result);
    return Response.json({ received: true });
  } catch (err) {
    console.error("[webhook/mp] falha ao processar:", err);
    return Response.json({ error: "Falha ao processar." }, { status: 500 });
  }
}
