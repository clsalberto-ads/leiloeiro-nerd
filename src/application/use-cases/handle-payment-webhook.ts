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
  ): Promise<{ status: string; statusDetail: string | null; externalReference: string | null }>;
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
  /**
   * (R6.1) Resolvedor de pagamentos de CARTÃO: o id do webhook não casa com
   * nenhum PIX nosso (a cobrança do checkout nasce com id diferente) — é
   * preciso descobrir de QUAIS vendedores tentar ler o pagamento.
   */
  connectedSellerIds?: () => Promise<string[]>;
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

  // 1. Casamento DIRETO: PIX nosso — o id do webhook É o id que gravamos.
  let payment = await paymentRepo.findByMpPaymentId(mpPaymentId);

  // 2. (R6.1) Casamento de CARTÃO (Checkout Pro): o id é de um pagamento que
  //    só existe AGORA — a cobrança nossa nasceu com o id do PIX (ou null).
  //    Percorre os vendedores conectados até um conseguir LER o pagamento (só
  //    o coletor lê), e o `external_reference` da MP aponta o NOSSO item. A
  //    cobrança pendente daquele item é a única que pode existir por
  //    construção (cascata é sequencial) — e ela ADOTA o id real: os próximos
  //    webhooks casam direto, sem resolvedor.
  if (!payment && deps.connectedSellerIds) {
    const sellers = await deps.connectedSellerIds();
    for (const sellerId of sellers) {
      try {
        const token = await getAccessToken(sellerId);
        const mpPayment = await fetchStatus.fetchMpPaymentStatus(token, mpPaymentId);
        if (!mpPayment.externalReference) continue;
        const item = await itemRepo.findById(mpPayment.externalReference);
        if (!item || item.sellerId !== sellerId) continue;
        const pending = (await paymentRepo.findByItemId(item.id)).find((p) => p.status === "pending");
        if (!pending) continue;
        const adopted = await paymentRepo.setMpPaymentId(pending.id, mpPaymentId);
        if (adopted) payment = adopted;
        break;
      } catch {
        // token de um vendedor que não é o coletor: 401/404 — segue para o
        // próximo; qualquer outro erro também é "não é dele" aqui.
        continue;
      }
    }
  }

  if (!payment) return { result: "ignored", reason: "payment-not-found" };
  if (payment.status !== "pending") return { result: "ignored", reason: "not-pending" };

  const item = await itemRepo.findById(payment.itemId);
  if (!item) return { result: "ignored", reason: "payment-not-found" };

  // ponytail (R5.4): o token do VENDEDOR é o caminho certo (ele é o coletor —
  // só ele LÊ o pagamento na MP). Mas se o vendedor DESCONECTOU a conta
  // depois de criar a cobrança, o getAccessToken lança e o pagamento fica
  // órfão para sempre: o cron sincronizar-mp bate na mesma parede a cada 15
  // minutos. O token da PLATAFORMA (MERCADO_PAGO_ACCESS_TOKEN no .env) é o
  // fallback: nem sempre consegue LER um pagamento do vendedor, mas tentar é
  // infinitamente melhor que desistir — e a falha do fallback loga qual dos
  // dois tokens está em falta.
  let accessToken: string;
  try {
    accessToken = await getAccessToken(item.sellerId);
  } catch (sellerTokenErr) {
    const platformToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!platformToken) {
      console.error(
        `[webhook] vendedor ${item.sellerId} sem conta MP e sem MERCADO_PAGO_ACCESS_TOKEN na plataforma — pagamento ${mpPaymentId} fica órfão:`,
        sellerTokenErr,
      );
      throw sellerTokenErr;
    }
    console.warn(
      `[webhook] token do vendedor ${item.sellerId} falhou (${String(sellerTokenErr).slice(0, 80)}); tentando o token da plataforma`,
    );
    accessToken = platformToken;
  }
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
