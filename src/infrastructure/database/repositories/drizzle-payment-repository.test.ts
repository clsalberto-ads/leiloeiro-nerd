import { describe, it, expect } from "vitest";
import { mapPayment, paymentToValues } from "./drizzle-payment-repository";
import type { PaymentRow } from "./drizzle-payment-repository";
import type { CreatePaymentInput } from "@/domain/repositories/payment-repository";

function makeRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: "p1",
    itemId: "i1",
    bidderId: "u1",
    bidId: "b1",
    amount: 10000,
    mpPaymentId: "mp-1",
    pixQrCode: "00020126360014br.gov.bcb.pix",
    pixQrCodeBase64: "img",
    paymentLink: "https://mercadopago.com.br/pay/1",
    status: "pending",
    deadline: new Date("2026-01-10T00:00:00Z"),
    attemptNumber: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeInput(overrides: Partial<CreatePaymentInput> = {}): CreatePaymentInput {
  return {
    itemId: "i1",
    bidderId: "u1",
    bidId: "b1",
    amount: 10000,
    mpPaymentId: "mp-1",
    pixQrCode: "img",
    pixCopiaECola: "00020126360014br.gov.bcb.pix",
    paymentLink: "https://mercadopago.com.br/pay/1",
    deadline: new Date("2026-01-10T00:00:00Z"),
    ...overrides,
  };
}

describe("drizzlePaymentRepository", () => {
  it("grava copia-e-cola em pix_qr_code e a imagem em pix_qr_code_base64", () => {
    const values = paymentToValues(makeInput());
    expect(values.pixQrCode).toBe("00020126360014br.gov.bcb.pix");
    expect(values.pixQrCodeBase64).toBe("img");
  });

  it("mapeia a leitura: pixCopiaECola ← pix_qr_code e pixQrCode ← pix_qr_code_base64", () => {
    const payment = mapPayment(makeRow());
    expect(payment.pixCopiaECola).toBe("00020126360014br.gov.bcb.pix");
    expect(payment.pixQrCode).toBe("img");
  });

  it("usa attemptNumber 1 como padrão do insert", () => {
    expect(paymentToValues(makeInput({ attemptNumber: undefined })).attemptNumber).toBe(1);
  });

  it("preserva os campos não-pix no insert", () => {
    const deadline = new Date("2026-02-01T00:00:00Z");
    const values = paymentToValues(makeInput({ deadline, attemptNumber: 3 }));
    expect(values.itemId).toBe("i1");
    expect(values.bidderId).toBe("u1");
    expect(values.bidId).toBe("b1");
    expect(values.amount).toBe(10000);
    expect(values.mpPaymentId).toBe("mp-1");
    expect(values.paymentLink).toBe("https://mercadopago.com.br/pay/1");
    expect(values.deadline).toBe(deadline);
    expect(values.attemptNumber).toBe(3);
  });

  it("status fica de fora do insert (default 'pending' no banco)", () => {
    expect(Object.keys(paymentToValues(makeInput()))).not.toContain("status");
  });
});