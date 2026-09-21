import { describe, it, expect } from "vitest";
import type { CreatePaymentInput, Payment, PaymentRepository } from "./payment-repository";

class FakePaymentRepository implements PaymentRepository {
  payments: Payment[] = [];

  async createPayment(input: CreatePaymentInput): Promise<Payment> {
    const payment: Payment = {
      id: "pay-1",
      itemId: input.itemId,
      bidderId: input.bidderId,
      bidId: input.bidId,
      amount: input.amount,
      mpPaymentId: input.mpPaymentId,
      pixQrCode: input.pixQrCode,
      pixCopiaECola: input.pixCopiaECola,
      paymentLink: input.paymentLink,
      status: "pending",
      deadline: input.deadline,
      attemptNumber: input.attemptNumber ?? 1,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    this.payments.push(payment);
    return payment;
  }

  async findById(id: string): Promise<Payment | null> {
    return this.payments.find((p) => p.id === id) ?? null;
  }

  async findByItemId(itemId: string): Promise<Payment[]> {
    return this.payments.filter((p) => p.itemId === itemId);
  }

  async findByChainIndex(itemId: string, attemptNumber: number): Promise<Payment | null> {
    return this.payments.find((p) => p.itemId === itemId && p.attemptNumber === attemptNumber) ?? null;
  }
}

function createPaymentInput(overrides: Partial<CreatePaymentInput> = {}): CreatePaymentInput {
  return {
    itemId: "i1",
    bidderId: "u1",
    bidId: "b1",
    amount: 10000,
    mpPaymentId: "mp-1",
    pixQrCode: "data:image/png;base64,xxx",
    pixCopiaECola: "00020126360014br.gov.bcb.pix",
    paymentLink: "https://mercadopago.com.br/pay/1",
    deadline: new Date("2026-01-10T00:00:00Z"),
    ...overrides,
  };
}

describe("PaymentRepository", () => {
  it("grava todos os campos ao criar payment com status pending", async () => {
    const repo = new FakePaymentRepository();
    const input = createPaymentInput();

    const payment = await repo.createPayment(input);

    expect(payment).toMatchObject({
      itemId: input.itemId,
      bidderId: input.bidderId,
      bidId: input.bidId,
      amount: input.amount,
      mpPaymentId: input.mpPaymentId,
      pixQrCode: input.pixQrCode,
      pixCopiaECola: input.pixCopiaECola,
      paymentLink: input.paymentLink,
      status: "pending",
      deadline: input.deadline,
    });
    expect(payment.attemptNumber).toBe(1);
    expect(repo.payments).toHaveLength(1);
  });

  it("fallback: sem PIX disponível, mantém o paymentLink e status pending", async () => {
    const repo = new FakePaymentRepository();

    const payment = await repo.createPayment(
      createPaymentInput({ mpPaymentId: null, pixQrCode: null, pixCopiaECola: null }),
    );

    expect(payment.pixQrCode).toBeNull();
    expect(payment.pixCopiaECola).toBeNull();
    expect(payment.paymentLink).toBe("https://mercadopago.com.br/pay/1");
    expect(payment.status).toBe("pending");
  });
});