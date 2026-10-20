import type { BidRepository, Bid } from "@/domain/repositories/bid-repository";
import type { ItemRepository } from "@/domain/repositories/item-repository";
import type { Payment, PaymentRepository } from "@/domain/repositories/payment-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { NotificationRepository } from "@/domain/repositories/notification-repository";
import { splitPayment } from "@/lib/platform-fee";
import { formatBRL } from "@/lib/format-brl";

// ponytail: a PORTA de pagamento do Mercado Pago. A assinatura fala a lingua do
// use case (centavos), nao da API da MP (reais) — a conversao mora na
// infraestrutura. `feeCents` viaja JUNTO do `amountCents` porque a taxa de
// marketplace e parte do contrato do pagamento, nao um detalhe de provedor.
export interface MpPixPayment {
  mpPaymentId: string;
  qrCodeBase64: string | null;
  qrCopiaECola: string | null;
}

export interface MpPaymentClient {
  createPixPayment(input: {
    accessToken: string;
    amountCents: number;
    feeCents: number;
    description: string;
    payerEmail: string;
    expiresAt: Date;
    externalReference: string;
  }): Promise<MpPixPayment>;
}

/** Token do vendedor válido (renova sozinho quando perto da expiração). */
export type SellerAccessTokenProvider = (userId: string) => Promise<string>;

export interface CreatePaymentDeps {
  itemRepo: Pick<ItemRepository, "findById">;
  bidRepo: BidRepository;
  paymentRepo: PaymentRepository;
  userRepo: Pick<UserRepository, "findByIds">;
  notifRepo: NotificationRepository;
  getAccessToken: SellerAccessTokenProvider;
  mpClient: MpPaymentClient;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Cria o pagamento do arremate para o 1º colocado (rank 1) de um item
 * ENCERRADO, na conta Mercado Pago do vendedor, com a taxa de marketplace (5%)
 * retida via `application_fee`.
 *
 * IDEMPOTENTE por tentativa: se já existe pagamento da tentativa 1 para o
 * item, devolve o existente sem tocar na MP — o worker pode repetir o job e o
 * vendedor pode clicar "gerar cobrança" duas vezes sem cobrar duas vezes.
 *
 * Notificação `won` ao arrematante é best-effort: falha nela não derruba o
 * pagamento (o mesmo acordo do placeBid com a notificação de lance superado).
 */
export async function createPayment(
  deps: CreatePaymentDeps,
  itemId: string,
  now: Date = new Date(),
): Promise<Payment> {
  const { itemRepo, bidRepo, paymentRepo, userRepo, notifRepo, getAccessToken, mpClient } = deps;

  const item = await itemRepo.findById(itemId);
  if (!item) throw new Error("Item não encontrado");
  if (item.status !== "closed") throw new Error("Pagamento só é gerado para item encerrado");

  // Idempotência primeiro: um pagamento já criado responde ANTES de qualquer
  // chamada à MP — a cota de API do vendedor não se gasta com retentativa.
  const existing = await paymentRepo.findByChainIndex(itemId, 1);
  if (existing) return existing;

  const bids = await bidRepo.findByItemId(itemId);
  if (bids.length === 0) throw new Error("Item sem lances — ninguém arrematou");
  const winner: Bid = bids[0]!; // findByItemId ordena por amount DESC

  const accessToken = await getAccessToken(item.sellerId);

  const [payer] = await userRepo.findByIds([winner.bidderId]);
  if (!payer?.email) throw new Error("Arrematante sem e-mail para a cobrança");

  const { platformFeeCents, sellerNetCents } = splitPayment(winner.amount);
  const deadline = new Date(now.getTime() + item.paymentDeadlineDays * MS_PER_DAY);

  const pix = await mpClient.createPixPayment({
    accessToken,
    amountCents: winner.amount,
    feeCents: platformFeeCents,
    description: `Arremate: ${item.title}`,
    payerEmail: payer.email,
    expiresAt: deadline,
    externalReference: item.id,
  });

  const payment = await paymentRepo.createPayment({
    itemId,
    bidderId: winner.bidderId,
    bidId: winner.id,
    amount: winner.amount,
    platformFeeCents,
    sellerNetCents,
    mpPaymentId: pix.mpPaymentId,
    pixQrCode: pix.qrCodeBase64,
    pixCopiaECola: pix.qrCopiaECola,
    paymentLink: null,
    deadline,
    attemptNumber: 1,
  });

  // Best-effort: o pagamento já existe; avisar o arrematante é importante, mas
  // perder o aviso não desfaz a cobrança nem pode derrubar o job do worker.
  // O caminho da página vai NO TEXTO da notificação — é o único destino do
  // arrematante até a Fase de e-mails, e a notificação é onde ele chega.
  try {
    await notifRepo.create({
      userId: winner.bidderId,
      type: "won",
      title: "Você arrematou um item!",
      content: `Parabéns! Você venceu o leilão de "${item.title}" com R$ ${formatBRL(winner.amount)}. Pague até ${deadline.toLocaleDateString("pt-BR")} em /dashboard/payments/${payment.id}`,
    });
  } catch (e) {
    console.error("[create-payment] falha ao notificar o arrematante vencedor:", e);
  }

  return payment;
}
