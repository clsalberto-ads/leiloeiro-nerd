import type { BidRepository, Bid } from "@/domain/repositories/bid-repository";
import type { ItemRepository } from "@/domain/repositories/item-repository";
import type { Payment, PaymentRepository } from "@/domain/repositories/payment-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { NotificationRepository } from "@/domain/repositories/notification-repository";
import { splitPayment } from "@/domain/value-objects/fee";
import { formatBRL } from "@/lib/format-brl";
import { renderNextBidderCalledEmail } from "@/lib/email-templates";
import { appBaseUrl, sendEmailBestEffort, type TransactionalEmailClient } from "@/lib/email-client";

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
  /** Opcional: e-mail `next_bidder_called` da cascata. Ausente = só in-app. */
  resend?: TransactionalEmailClient | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Opções da CASCATA: quem paga, em qual tentativa e com qual prazo.
 *
 * ponytail: ausentes = fluxo do VENCEDOR (rank 1, tentativa 1, prazo de
 * `paymentDeadlineDays`, notificação `won`). Presentes = o cron
 * `verificar-prazos` chamando o PRÓXIMO da fila (spec §3.5: arrematante
 * anterior não pagou; deadline de `cascadeDeadlineDays`, default 1 dia;
 * notificação `next_bidder_called`). A mecânica de criar o pagamento — taxa
 * de 5%, token do vendedor, PIX, idempotência por tentativa — é UMA só.
 */
export interface CreatePaymentOptions {
  target?: {
    bidderId: string;
    bidId: string;
    attemptNumber: number;
  };
  /** Prazo em dias. Default: `item.paymentDeadlineDays` (vencedor). */
  deadlineDays?: number;
  /** Notificação best-effort ao arrematante. `none` = o chamador avisa. */
  notify?: "won" | "next_bidder_called" | "none";
}

/**
 * Cria o pagamento do arremate para o 1º colocado (rank 1) de um item
 * ENCERRADO, na conta Mercado Pago do vendedor, com a taxa de marketplace (5%)
 * retida via `application_fee`.
 *
 * IDEMPOTENTE por tentativa: se já existe pagamento da tentativa (1, ou a da
 * cascata), devolve o existente sem tocar na MP — o worker pode repetir o job
 * e o vendedor pode clicar "gerar cobrança" duas vezes sem cobrar duas vezes.
 *
 * Notificação ao arrematante é best-effort: falha nela não derruba o
 * pagamento (o mesmo acordo do placeBid com a notificação de lance superado).
 */
export async function createPayment(
  deps: CreatePaymentDeps,
  itemId: string,
  now: Date = new Date(),
  options: CreatePaymentOptions = {},
): Promise<Payment> {
  const { itemRepo, bidRepo, paymentRepo, userRepo, notifRepo, getAccessToken, mpClient } = deps;

  const item = await itemRepo.findById(itemId);
  if (!item) throw new Error("Item não encontrado");
  if (item.status !== "closed") throw new Error("Pagamento só é gerado para item encerrado");

  const attemptNumber = options.target?.attemptNumber ?? 1;

  // Idempotência primeiro: um pagamento já criado responde ANTES de qualquer
  // chamada à MP — a cota de API do vendedor não se gasta com retentativa.
  const existing = await paymentRepo.findByChainIndex(itemId, attemptNumber);
  if (existing) return existing;

  let winner: Bid;
  if (options.target) {
    // Cascata: o cron JÁ escolheu quem é o próximo (excluindo quem já teve
    // tentativa); aqui só confirma que o lance existe e é do item.
    const targetBid = (await bidRepo.findByItemId(itemId)).find(
      (b) => b.id === options.target!.bidId,
    );
    if (!targetBid || targetBid.bidderId !== options.target.bidderId) {
      throw new Error("Lance da cascata não encontrado para este item");
    }
    winner = targetBid;
  } else {
    const bids = await bidRepo.findByItemId(itemId);
    if (bids.length === 0) throw new Error("Item sem lances — ninguém arrematou");
    winner = bids[0]!; // findByItemId ordena por amount DESC
  }

  const accessToken = await getAccessToken(item.sellerId);

  const [payer] = await userRepo.findByIds([winner.bidderId]);
  if (!payer?.email) throw new Error("Arrematante sem e-mail para a cobrança");

  const { platformFeeCents, sellerNetCents } = splitPayment(winner.amount);
  const deadlineDays = options.deadlineDays ?? item.paymentDeadlineDays;
  const deadline = new Date(now.getTime() + deadlineDays * MS_PER_DAY);

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
    attemptNumber,
  });

  // Best-effort: o pagamento já existe; avisar o arrematante é importante, mas
  // perder o aviso não desfaz a cobrança nem pode derrubar o job do worker.
  // O caminho da página vai NO TEXTO da notificação — é o destino do
  // arrematante nas duas horas seguintes.
  const notifyType = options.notify ?? "won";
  try {
    if (notifyType === "won") {
      await notifRepo.create({
        userId: winner.bidderId,
        type: "won",
        title: "Você arrematou um item!",
        content: `Parabéns! Você venceu o leilão de "${item.title}" com R$ ${formatBRL(winner.amount)}. Pague até ${deadline.toLocaleDateString("pt-BR")} em /dashboard/payments/${payment.id}`,
      });
    } else if (notifyType === "next_bidder_called") {
      await notifRepo.create({
        userId: winner.bidderId,
        type: "next_bidder_called",
        title: "Você foi chamado para pagar um item!",
        content: `O arrematante anterior não pagou o item "${item.title}". Você está na sequência! Pague R$ ${formatBRL(winner.amount)} até ${deadline.toLocaleDateString("pt-BR")} em /dashboard/payments/${payment.id}`,
      });
    }
  } catch (e) {
    console.error("[create-payment] falha ao notificar o arrematante:", e);
  }

  // E-mail da CASCATA (o `won` é só in-app — a spec não define template de
  // vitória). O `payer` já foi consultado para o PIX: o mesmo endereço.
  if (notifyType === "next_bidder_called" && deps.resend) {
    try {
      await sendEmailBestEffort(deps.resend, {
        to: payer.email,
        subject: "Você foi chamado para pagar um item!",
        html: renderNextBidderCalledEmail({
          bidderName: payer.name,
          itemTitle: item.title,
          amount: winner.amount,
          deadline,
          paymentUrl: `${appBaseUrl()}/dashboard/payments/${payment.id}`,
        }),
      });
    } catch (e) {
      console.error("[create-payment] falha ao enviar e-mail da cascata:", e);
    }
  }

  return payment;
}
