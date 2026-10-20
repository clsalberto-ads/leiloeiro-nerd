import type { BidRepository } from "@/domain/repositories/bid-repository";
import type { ItemRepository } from "@/domain/repositories/item-repository";
import type { Payment, PaymentRepository } from "@/domain/repositories/payment-repository";
import type { NotificationRepository } from "@/domain/repositories/notification-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import { createPayment, type CreatePaymentDeps } from "./create-payment";
import { formatBRL } from "@/lib/format-brl";

/** Prazo de cada nova cobrança da cascata quando o item não define o próprio. */
export const DEFAULT_CASCADE_DAYS = 1; // 24h (spec §3.5)

export interface VerificarPrazosDeps extends CreatePaymentDeps {
  paymentRepo: PaymentRepository;
  bidRepo: BidRepository;
  // Override do Pick do CreatePaymentDeps: a cascata também PRECISA do
  // `setStatus` (fim da cascata → item cancelled). O CreatePayment em si
  // continua exigindo só `findById`; este estreitamento é aditivo.
  itemRepo: Pick<ItemRepository, "findById" | "setStatus">;
  notifRepo: NotificationRepository;
  userRepo: Pick<UserRepository, "findByIds">;
}

export interface VerificarPrazosResult {
  /** Pendentes que venceram NESTE tick (transição ganha). */
  expired: number;
  /** Novas cobranças de cascata criadas. */
  cascaded: number;
  /** Itens encerrados por adimplência esgotada (nenhum arrematante pagou). */
  cancelledItems: number;
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
  const result: VerificarPrazosResult = { expired: 0, cascaded: 0, cancelledItems: 0 };

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
  const expiredPayments = await paymentRepo.findExpired();
  for (const expired of expiredPayments) {
    const nextAttempt = expired.attemptNumber + 1;
    // já existe a próxima cobrança? a cascata deste pagamento já ocorreu
    if (await paymentRepo.findByChainIndex(expired.itemId, nextAttempt)) continue;

    const item = await itemRepo.findById(expired.itemId);
    // item sumido, já pago ou já cancelado: nada a fazer
    if (!item || item.status === "paid" || item.status === "cancelled") continue;

    const attempted = new Set(
      (await paymentRepo.findByItemId(expired.itemId)).map((p) => p.bidderId),
    );
    const bids = await bidRepo.findByItemId(expired.itemId);
    // o próximo da fila: maior lance de quem AINDA não teve tentativa
    const next = bids.find((b) => !attempted.has(b.bidderId));

    if (next) {
      try {
        await createPayment(deps, expired.itemId, now, {
          target: { bidderId: next.bidderId, bidId: next.id, attemptNumber: nextAttempt },
          deadlineDays: item.cascadeDeadlineDays ?? DEFAULT_CASCADE_DAYS,
          notify: "next_bidder_called",
        });
        result.cascaded += 1;
      } catch (e) {
        // best-effort por item: a falha de UM não trava os outros, e o
        // próximo tick refaz (o `expired` continua sem a próxima tentativa).
        console.error(
          `[verificar-prazos] falha ao gerar cobranca da cascata do item ${expired.itemId} (tentativa ${nextAttempt}):`,
          e,
        );
      }
    } else {
      // Lances esgotados: status-fim explícito da spec — nenhum arrematante
      // validou pagamento. O item é cancelado e o ÚLTIMO acionado é avisado.
      await itemRepo.setStatus(expired.itemId, "cancelled");
      result.cancelledItems += 1;
      try {
        await notifRepo.create({
          userId: expired.bidderId,
          type: "payment_expired",
          title: "Prazo de pagamento vencido",
          content: `Seu prazo para pagar R$ ${formatBRL(expired.amount)} pelo item "${item.title}" venceu e a sua cobrança foi encerrada.`,
        });
      } catch (e) {
        console.error("[verificar-prazos] falha ao notificar expiração final:", e);
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
