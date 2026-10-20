import type { ItemRepository } from "@/domain/repositories/item-repository";
import type { Payment, PaymentRepository } from "@/domain/repositories/payment-repository";
import type { NotificationRepository } from "@/domain/repositories/notification-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import { formatBRL } from "@/lib/format-brl";
import { renderPaymentConfirmedEmail } from "@/lib/email-templates";
import { appBaseUrl, sendEmailBestEffort, type TransactionalEmailClient } from "@/lib/email-client";

// ponytail: a porta que pergunta À MP qual é o status de verdade. O corpo do
// webhook só carrega o `id`; o status vem desta consulta, feita com o token
// do VENDEDOR (o dono da cobrança). O use case não sabe HTTP — quem monta é
// a rota/infraestrutura (o mesmo desenho do MpPaymentClient do createPayment).
export interface MpStatusFetcher {
  fetchMpPaymentStatus(
    accessToken: string,
    mpPaymentId: string,
  ): Promise<{ status: string; statusDetail: string | null }>;
}

export type SellerAccessTokenProvider = (userId: string) => Promise<string>;

export interface HandlePaymentWebhookDeps {
  paymentRepo: PaymentRepository;
  itemRepo: Pick<ItemRepository, "findById" | "setStatus">;
  notifRepo: NotificationRepository;
  getAccessToken: SellerAccessTokenProvider;
  fetchStatus: MpStatusFetcher;
  /** Opcional: e-mail `payment_confirmed` best-effort. Ausente = só in-app. */
  resend?: TransactionalEmailClient | null;
  userRepo?: Pick<UserRepository, "findByIds">;
}

export type WebhookOutcome =
  | { result: "ignored"; reason: "payment-not-found" | "not-pending" | "status-unchanged" }
  | { result: "approved"; payment: Payment }
  | { result: "cancelled"; payment: Payment };

// ponytail: o mapa do status DA MP para a decisão DAQUI. Fechado e minúsculo
// de propósito — só os status que MUDAM algo no nosso fluxo entram; o resto
// (`in_process`, `pending`…) é "status-unchanged" e vira 200 no silêncio. A
// CASCATA NÃO mora aqui: expirar é papel do cron `verificar-prazos` (spec
// §3.3 — "evita gatilhos duplicados"); o webhook só espelha o que a MP diz.
const CANCELLING_MP_STATUSES = new Set(["rejected", "cancelled"]);

/**
 * Processa um webhook de pagamento: busca o pagamento pelo id da MP, consulta o
 * status REAL na conta do vendedor e aplica a transição correspondente.
 *
 * - `approved`: transição atômica `pending → approved` (quem perde a corrida
 *   recebe null e NÃO anuncia de novo), item vira `paid`, notificação
 *   `payment_confirmed` best-effort.
 * - `rejected/cancelled`: sincroniza o status local (sem cascata — cron).
 * - qualquer outra coisa (inclusive pagamento já finalizado): idempotente,
 *   `ignored` — a MP recebe 200 e para de reenviar.
 */
export async function handlePaymentWebhook(
  deps: HandlePaymentWebhookDeps,
  mpPaymentId: string,
): Promise<WebhookOutcome> {
  const { paymentRepo, itemRepo, notifRepo, getAccessToken, fetchStatus } = deps;

  const payment = await paymentRepo.findByMpPaymentId(mpPaymentId);
  if (!payment) return { result: "ignored", reason: "payment-not-found" };
  if (payment.status !== "pending") return { result: "ignored", reason: "not-pending" };

  const item = await itemRepo.findById(payment.itemId);
  if (!item) return { result: "ignored", reason: "payment-not-found" };

  const accessToken = await getAccessToken(item.sellerId);
  const mp = await fetchStatus.fetchMpPaymentStatus(accessToken, mpPaymentId);

  if (mp.status === "approved") {
    // Corrida entre webhooks duplicados: SÓ um recebe a linha.
    const approved = await paymentRepo.markApproved(payment.id);
    if (!approved) return { result: "ignored", reason: "not-pending" };

    await itemRepo.setStatus(payment.itemId, "paid");

    // Best-effort: o pagamento já está aprovado; a notificação é o aviso, não
    // a escrita. In-app E e-mail são independentes — um cair não derruba o outro.
    try {
      await notifRepo.create({
        userId: payment.bidderId,
        type: "payment_confirmed",
        title: "Pagamento confirmado!",
        content: `O pagamento de R$ ${formatBRL(payment.amount)} do item "${item.title}" foi confirmado. O vendedor já foi avisado.`,
      });
    } catch (e) {
      console.error("[webhook] falha ao notificar pagamento confirmado:", e);
    }

    if (deps.resend && deps.userRepo) {
      try {
        const [buyer] = await deps.userRepo.findByIds([payment.bidderId]);
        if (buyer?.email) {
          await sendEmailBestEffort(deps.resend, {
            to: buyer.email,
            subject: "Pagamento confirmado!",
            html: renderPaymentConfirmedEmail({
              bidderName: buyer.name,
              itemTitle: item.title,
              amount: payment.amount,
              paymentUrl: `${appBaseUrl()}/dashboard/payments/${payment.id}`,
            }),
          });
        }
      } catch (e) {
        console.error("[webhook] falha ao enviar e-mail de pagamento confirmado:", e);
      }
    }

    return { result: "approved", payment: approved };
  }

  if (CANCELLING_MP_STATUSES.has(mp.status)) {
    const cancelled = await paymentRepo.markCancelled(payment.id);
    if (!cancelled) return { result: "ignored", reason: "not-pending" };
    return { result: "cancelled", payment: cancelled };
  }

  return { result: "ignored", reason: "status-unchanged" };
}
