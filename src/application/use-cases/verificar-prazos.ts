import type { BidRepository } from "@/domain/repositories/bid-repository";
import type { ItemRepository } from "@/domain/repositories/item-repository";
import type { Payment, PaymentRepository } from "@/domain/repositories/payment-repository";
import type { NotificationRepository } from "@/domain/repositories/notification-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import { createPayment, type CreatePaymentDeps } from "./create-payment";
import { formatBRL } from "@/lib/format-brl";
import {
  renderPaymentDueEmail,
  renderPaymentExpiredEmail,
} from "@/lib/email-templates";
import {
  appBaseUrl,
  sendEmailBestEffort,
  type TransactionalEmailClient,
} from "@/lib/email-client";

/** Prazo de cada nova cobrança da cascata quando o item não define o próprio. */
export const DEFAULT_CASCADE_DAYS = 1; // 24h (spec §3.5)

/** Janela do lembrete `payment_due`: vence em menos de 24h → avisa uma vez. */
export const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface VerificarPrazosDeps extends CreatePaymentDeps {
  paymentRepo: PaymentRepository;
  bidRepo: BidRepository;
  // Override do Pick do CreatePaymentDeps: a cascata também PRECISA do
  // `setStatus` (fim da cascata → item cancelled). O CreatePayment em si
  // continua exigindo só `findById`; este estreitamento é aditivo.
  itemRepo: Pick<ItemRepository, "findById" | "setStatus">;
  notifRepo: NotificationRepository;
  userRepo: Pick<UserRepository, "findByIds">;
  /** Opcional: e-mails transacionais best-effort. Ausente = só in-app. */
  resend?: TransactionalEmailClient | null;
}

export interface VerificarPrazosResult {
  /** Pendentes que venceram NESTE tick (transição ganha). */
  expired: number;
  /** Novas cobranças de cascata criadas. */
  cascaded: number;
  /** Itens encerrados por adimplência esgotada (nenhum arrematante pagou). */
  cancelledItems: number;
  /** Lembretes `payment_due` enviados (um por pagamento, garantido pela coluna). */
  reminded: number;
}

/**
 * O ÚNICO gatilho da cascata (spec §3.3): o webhook NÃO dispara cascata,
 * exatamente para não existirem dois gatilhos disputando o mesmo item.
 *
 * Dois passos:
 *  1. VENCE os pendentes cujo prazo passou (`markExpired` atômico: quem
 *     perde a corrida para um webhook `approved` concorrente não vence nada).
 *  2. CASCATA sobre cada `expired` SEM pagamento na tentativa seguinte —
 *     self-healing de propósito: se a cobrança da cascata falhou num tick
 *     (MP fora do ar), o próximo tick reencontra o mesmo `expired` e refaz.
 *     Lances esgotados = fim: item `cancelled` + `payment_expired` ao último
 *     arrematante acionado.
 */
export async function verificarPrazos(
  deps: VerificarPrazosDeps,
  now: Date = new Date(),
): Promise<VerificarPrazosResult> {
  const { paymentRepo, bidRepo, itemRepo, notifRepo } = deps;
  const result: VerificarPrazosResult = { expired: 0, cascaded: 0, cancelledItems: 0, reminded: 0 };

  // 1. Vence os pendentes com prazo passado.
  const due = await paymentRepo.findExpiredPending(now);
  for (const payment of due) {
    const marked = await paymentRepo.markExpired(payment.id);
    if (marked) {
      result.expired += 1;
      console.log(
        `[verificar-prazos] pagamento ${payment.id} venceu (item ${payment.itemId}, tentativa ${payment.attemptNumber})`,
      );
    }
  }

  // 2. Cascata sobre TODO `expired` cuja tentativa seguinte ainda não existe.
  const chainBroken = await paymentRepo.findCascadeCandidates();
  for (const broken of chainBroken) {
    const nextAttempt = broken.attemptNumber + 1;
    // já existe a próxima cobrança? a cascata deste pagamento já ocorreu
    if (await paymentRepo.findByChainIndex(broken.itemId, nextAttempt)) continue;

    const item = await itemRepo.findById(broken.itemId);
    // item sumido, já pago ou já cancelado: nada a fazer
    if (!item || item.status === "paid" || item.status === "cancelled") continue;

    const attempted = new Set(
      (await paymentRepo.findByItemId(broken.itemId)).map((p) => p.bidderId),
    );
    const bids = await bidRepo.findByItemId(broken.itemId);
    // o próximo da fila: maior lance de quem AINDA não teve tentativa
    const next = bids.find((b) => !attempted.has(b.bidderId));

    if (next) {
      try {
        await createPayment(deps, broken.itemId, now, {
          target: { bidderId: next.bidderId, bidId: next.id, attemptNumber: nextAttempt },
          deadlineDays: item.cascadeDeadlineDays ?? DEFAULT_CASCADE_DAYS,
          notify: "next_bidder_called",
        });
        result.cascaded += 1;
      } catch (e) {
        // best-effort por item: a falha de UM não trava os outros, e o
        // próximo tick refaz (o `expired` continua sem a próxima tentativa).
        console.error(
          `[verificar-prazos] falha ao gerar cobranca da cascata do item ${broken.itemId} (tentativa ${nextAttempt}):`,
          e,
        );
      }
    } else {
      // Lances esgotados: status-fim explícito da spec — nenhum arrematante
      // validou pagamento. O item é cancelado e o ÚLTIMO acionado é avisado.
      await itemRepo.setStatus(broken.itemId, "cancelled");
      result.cancelledItems += 1;
      try {
        await notifRepo.create({
          userId: broken.bidderId,
          type: "payment_expired",
          title: "Prazo de pagamento vencido",
          content: `Seu prazo para pagar R$ ${formatBRL(broken.amount)} pelo item "${item.title}" venceu e a sua cobrança foi encerrada.`,
          link: `/dashboard/payments/${broken.id}`,
        });
      } catch (e) {
        console.error("[verificar-prazos] falha ao notificar expiração final:", e);
      }

      if (deps.resend) {
        try {
          const [lastBidder] = await deps.userRepo.findByIds([broken.bidderId]);
          if (lastBidder?.email) {
            await sendEmailBestEffort(deps.resend, {
              to: lastBidder.email,
              subject: "Prazo de pagamento vencido",
              html: renderPaymentExpiredEmail({
                bidderName: lastBidder.name,
                itemTitle: item.title,
                amount: broken.amount,
                paymentUrl: `${appBaseUrl()}/dashboard/payments/${broken.id}`,
              }),
            });
          }
        } catch (e) {
          console.error("[verificar-prazos] falha ao enviar e-mail de expiração:", e);
        }
      }
    }
  }

  // 3. Lembrete `payment_due`: pendentes que vencem nas próximas 24h e ainda
  //    não foram lembrados. A reivindicação é ATÔMICA (`markReminderSent` com
  //    WHERE reminder_sent_at IS NULL): dois ticks não enviam dois lembretes.
  //    O guarda de janela (total >= 24h) exclui as cobranças da CASCATA, que
  //    nascem com prazo de 24h — o e-mail de chamada delas JÁ é o aviso, e um
  //    lembrete em cima seria o mesmo e-mail duas vezes.
  if (deps.resend) {
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);
    const dueSoon = await paymentRepo.findPendingReminderDue(now, windowEnd);
    for (const payment of dueSoon) {
      const totalWindow = payment.deadline.getTime() - payment.createdAt.getTime();
      // <= (e não <): a cobrança da cascata tem janela de EXATAMENTE 24h
      // (1 dia) — o teste do lembrete trava esse limite inclusivo.
      if (totalWindow <= REMINDER_WINDOW_MS) continue; // cascata: já avisada na criação
      const claimed = await paymentRepo.markReminderSent(payment.id, now);
      if (!claimed) continue; // outro tick venceu a disputa
      try {
        const item = await itemRepo.findById(payment.itemId);
        const [bidder] = await deps.userRepo.findByIds([payment.bidderId]);
        if (item && bidder?.email) {
          await sendEmailBestEffort(deps.resend, {
            to: bidder.email,
            subject: "Seu pagamento vence em breve",
            html: renderPaymentDueEmail({
              bidderName: bidder.name,
              itemTitle: item.title,
              amount: payment.amount,
              deadline: payment.deadline,
              paymentUrl: `${appBaseUrl()}/dashboard/payments/${payment.id}`,
            }),
          });
          result.reminded += 1;
        }
      } catch (e) {
        console.error("[verificar-prazos] falha ao enviar lembrete de vencimento:", e);
      }
    }
  }

  return result;
}

/**
 * Rede de segurança do webhook: pendentes criados há mais de 1h são
 * RECONCILIADOS com a MP (o pagamento pode ter sido aprovado sem que o
 * webhook chegasse). Reusa o `handlePaymentWebhook` inteiro — a
 * sincronização É a mesma lógica do webhook, só com outro gatilho — e por
 * isso NUNCA dispara cascata (a função dele não a dispara; o `verificar-prazos`
 * acima é o único gatilho, spec §3.3/§3.4).
 */
export async function sincronizarMp(
  deps: Pick<VerificarPrazosDeps, "paymentRepo"> & {
    handleWebhook: (mpPaymentId: string) => Promise<unknown>;
  },
  now: Date = new Date(),
): Promise<{ checked: number }> {
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000);
  const stale = (await deps.paymentRepo.findPendingCreatedBefore(cutoff)).filter(
    (p: Payment) => p.mpPaymentId !== null,
  );

  let checked = 0;
  for (const payment of stale) {
    try {
      await deps.handleWebhook(payment.mpPaymentId!);
      checked += 1;
    } catch (e) {
      // best-effort por pagamento: o próximo tick re-tenta
      console.error(`[sincronizar-mp] falha ao sincronizar ${payment.mpPaymentId}:`, e);
    }
  }
  return { checked };
}
