import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { payments } from "@/infrastructure/database/schema";
import type {
  CreatePaymentInput,
  Payment,
  PaymentRepository,
} from "@/domain/repositories/payment-repository";

export type PaymentRow = typeof payments.$inferSelect;

// ponytail: mapeamento canônico pix — pix_qr_code guarda o payload copia-e-cola
// (MP `qr_code`), pix_qr_code_base64 guarda a imagem do QR (MP `qr_code_base64`).
// O contrato domain usa pixCopiaECola para o payload e pixQrCode para a imagem.
export function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    itemId: row.itemId,
    bidderId: row.bidderId,
    bidId: row.bidId,
    amount: row.amount,
    platformFeeCents: row.platformFeeCents,
    sellerNetCents: row.sellerNetCents,
    mpPaymentId: row.mpPaymentId,
    pixQrCode: row.pixQrCodeBase64,
    pixCopiaECola: row.pixQrCode,
    paymentLink: row.paymentLink,
    status: row.status,
    deadline: row.deadline,
    attemptNumber: row.attemptNumber,
    reminderSentAt: row.reminderSentAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function paymentToValues(input: CreatePaymentInput) {
  return {
    itemId: input.itemId,
    bidderId: input.bidderId,
    bidId: input.bidId,
    amount: input.amount,
    platformFeeCents: input.platformFeeCents,
    sellerNetCents: input.sellerNetCents,
    mpPaymentId: input.mpPaymentId,
    pixQrCode: input.pixCopiaECola,
    pixQrCodeBase64: input.pixQrCode,
    paymentLink: input.paymentLink,
    deadline: input.deadline,
    attemptNumber: input.attemptNumber ?? 1,
  };
}

export const drizzlePaymentRepository: PaymentRepository = {
  async createPayment(input: CreatePaymentInput): Promise<Payment> {
    const [row] = await db
      .insert(payments)
      .values(paymentToValues(input))
      .returning();

    return mapPayment(row!);
  },

  async findById(id: string): Promise<Payment | null> {
    const [row] = await db.select().from(payments).where(eq(payments.id, id));
    return row ? mapPayment(row) : null;
  },

  async findByMpPaymentId(mpPaymentId: string): Promise<Payment | null> {
    const [row] = await db
      .select()
      .from(payments)
      .where(eq(payments.mpPaymentId, mpPaymentId))
      .limit(1);
    return row ? mapPayment(row) : null;
  },

  async findByItemId(itemId: string): Promise<Payment[]> {
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.itemId, itemId))
      .orderBy(desc(payments.amount));
    return rows.map(mapPayment);
  },

  async findByChainIndex(itemId: string, attemptNumber: number): Promise<Payment | null> {
    const [row] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.itemId, itemId), eq(payments.attemptNumber, attemptNumber)));
    return row ? mapPayment(row) : null;
  },

  async markCancelled(id: string): Promise<Payment | null> {
    const [row] = await db
      .update(payments)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return row ? mapPayment(row) : null;
  },

  async markApproved(id: string): Promise<Payment | null> {
    // Transição ÚNICA pending → approved: só quem muda devolve a linha
    // (ver o contrato no `PaymentRepository.markApproved`). O `status` no
    // SET usa `as const` implícito do enum do drizzle.
    const [row] = await db
      .update(payments)
      .set({ status: "approved", updatedAt: new Date() })
      .where(and(eq(payments.id, id), eq(payments.status, "pending")))
      .returning();
    return row ? mapPayment(row) : null;
  },

  async markExpired(id: string): Promise<Payment | null> {
    // Mesma transição condicional do markApproved: o cron não pode vencer o
    // pagamento que o webhook acabou de aprovar.
    const [row] = await db
      .update(payments)
      .set({ status: "expired", updatedAt: new Date() })
      .where(and(eq(payments.id, id), eq(payments.status, "pending")))
      .returning();
    return row ? mapPayment(row) : null;
  },

  async findExpiredPending(now: Date): Promise<Payment[]> {
    const rows = await db
      .select()
      .from(payments)
      .where(and(eq(payments.status, "pending"), lte(payments.deadline, now)));
    return rows.map(mapPayment);
  },

  async findCascadeCandidates(): Promise<Payment[]> {
    // A cadeia quebrou por EXPIRAÇÃO ou por CANCELAMENTO — os dois caminhos
    // chamam o próximo da fila (ver o contrato no domínio).
    const rows = await db
      .select()
      .from(payments)
      .where(inArray(payments.status, ["expired", "cancelled"]));
    return rows.map(mapPayment);
  },

  async findPendingCreatedBefore(cutoff: Date): Promise<Payment[]> {
    const rows = await db
      .select()
      .from(payments)
      .where(and(eq(payments.status, "pending"), lte(payments.createdAt, cutoff)));
    return rows.map(mapPayment);
  },

  async findPendingReminderDue(windowStart: Date, windowEnd: Date): Promise<Payment[]> {
    // Pendentes que vencem DENTRO da janela e ainda não foram lembrados. O
    // `reminderSentAt IS NULL` é o que impede o reenvio a cada tick.
    const rows = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.status, "pending"),
          gte(payments.deadline, windowStart),
          lte(payments.deadline, windowEnd),
          isNull(payments.reminderSentAt),
        ),
      );
    return rows.map(mapPayment);
  },

  async setMpPaymentId(id: string, mpPaymentId: string): Promise<Payment | null> {
    // Só em `pending`: a adoção acontece quando o CARTÃO paga uma cobrança
    // que ainda está em aberto — depois disso os webhooks casam pelo id novo.
    const [row] = await db
      .update(payments)
      .set({ mpPaymentId, updatedAt: new Date() })
      .where(and(eq(payments.id, id), eq(payments.status, "pending")))
      .returning();
    return row ? mapPayment(row) : null;
  },

  async markReminderSent(id: string, at: Date): Promise<Payment | null> {
    // Reivindicação atômica: só o primeiro tick que chega marca (e envia).
    const [row] = await db
      .update(payments)
      .set({ reminderSentAt: at, updatedAt: at })
      .where(and(eq(payments.id, id), isNull(payments.reminderSentAt)))
      .returning();
    return row ? mapPayment(row) : null;
  },
};