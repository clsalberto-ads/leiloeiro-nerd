export type PaymentStatus = "pending" | "approved" | "expired" | "cancelled" | "refunded";

export interface Payment {
  id: string;
  itemId: string;
  bidderId: string;
  bidId: string;
  amount: number;
  // ponytail: o LEDGER da taxa de marketplace (5%). Vem junto do `amount`
  // porque os KPIs e a página de pagamento leem os três — e a soma
  // `sellerNetCents + platformFeeCents === amount` é o invariante que o
  // `splitPayment` (@/domain/value-objects/fee) garante na criação.
  platformFeeCents: number;
  sellerNetCents: number;
  mpPaymentId: string | null;
  /** Imagem do QR Code PIX (ex.: data URL base64 do MP `qr_code_base64`). */
  pixQrCode: string | null;
  /** Payload copia-e-cola (MP `qr_code`). */
  pixCopiaECola: string | null;
  paymentLink: string | null;
  status: PaymentStatus;
  deadline: Date;
  attemptNumber: number;
  /**
   * Quando o e-mail `payment_due` (24h antes do vencimento) foi enviado.
   * `null` = ainda não enviado — é o que o cron consulta e o que
   * `markReminderSent` reivindica atomicamente.
   */
  reminderSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentInput {
  itemId: string;
  bidderId: string;
  bidId: string;
  amount: number;
  platformFeeCents: number;
  sellerNetCents: number;
  mpPaymentId: string | null;
  pixQrCode: string | null;
  pixCopiaECola: string | null;
  paymentLink: string | null;
  deadline: Date;
  attemptNumber?: number;
}

export interface PaymentRepository {
  createPayment(input: CreatePaymentInput): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  /** O pagamento dono de um id do Mercado Pago — a entrada do webhook. */
  findByMpPaymentId(mpPaymentId: string): Promise<Payment | null>;
  findByItemId(itemId: string): Promise<Payment[]>;
  findByChainIndex(itemId: string, attemptNumber: number): Promise<Payment | null>;
  markCancelled(id: string): Promise<Payment | null>;
  /**
   * Aprova o pagamento, SÓ SE ele estiver `pending`.
   *
   * ponytail: o `WHERE status = 'pending'` é a IDEMPOTÊNCIA do webhook. A MP
   * reenvia o evento (retry, duplicação) e dois webhooks do mesmo pagamento
   * podem chegar em concorrência: os dois leriam `pending`, os dois
   * "aprovariam", e a notificação `payment_confirmed` iria DUAS vezes. A
   * transição condicional no UPDATE devolve a linha SÓ para quem a mudou — o
   * perdedor recebe `null` e não tem nada a anunciar.
   */
  markApproved(id: string): Promise<Payment | null>;
  /**
   * Vence o pagamento, SÓ SE ele estiver `pending` (o mesmo invariante do
   * `markApproved`): o cron e o webhook aprovando no mesmo instante são uma
   * corrida real, e quem perde leva `null` — um pagamento que a MP aprovou
   * NÃO pode terminar `expired`.
   */
  markExpired(id: string): Promise<Payment | null>;
  /** Pendentes cujo prazo já passou — a fila do cron `verificar-prazos`. */
  findExpiredPending(now: Date): Promise<Payment[]>;
  /**
   * Pagamentos que QUEBRARAM a cadeia — `expired` OU `cancelled` — matéria-
   * -prima da CASCATA auto-recuperável: cada um sem pagamento na tentativa
   * seguinte é uma cascata pendente (falhou na hora? o próximo tick refaz).
   *
   * ponytail: `cancelled` ESTÁ aqui de propósito. O arrematante que cancela a
   * própria cobrança (ou a MP recusa) desistiu EXPLICITAMENTE — é ainda mais
   * motivo para chamar o próximo da fila do que o vencimento. A versão que só
   * via `expired` deixava o item `closed` PARA SEMPRE: cancelado não expira,
   * `findExpiredPending` não o via, e nem os próximos lances eram chamados
   * nem o item era encerrado. `refunded` fica DE FORA: reembolso é fluxo de
   * admin, com dinheiro que voltou — não é desistência de arrematante.
   */
  findCascadeCandidates(): Promise<Payment[]>;
  /** Pendentes criados antes do corte — a fila do cron `sincronizar-mp`. */
  findPendingCreatedBefore(cutoff: Date): Promise<Payment[]>;
  /**
   * Pendentes cujo vencimento está dentro da janela (`.guardado pelo cron de
   * prazos para o lembrete `payment_due`) e que AINDA não receberam lembrete.
   */
  findPendingReminderDue(windowStart: Date, windowEnd: Date): Promise<Payment[]>;
  /**
   * Marca o lembrete como enviado, SÓ se ainda não estava (`WHERE
   * reminder_sent_at IS NULL`) — dois ticks do cron disputando o mesmo
   * pagamento: só o primeiro envia.
   */
  markReminderSent(id: string, at: Date): Promise<Payment | null>;
}