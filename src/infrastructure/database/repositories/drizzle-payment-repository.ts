import { and, desc, eq } from "drizzle-orm";
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
    mpPaymentId: row.mpPaymentId,
    pixQrCode: row.pixQrCodeBase64,
    pixCopiaECola: row.pixQrCode,
    paymentLink: row.paymentLink,
    status: row.status,
    deadline: row.deadline,
    attemptNumber: row.attemptNumber,
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
};