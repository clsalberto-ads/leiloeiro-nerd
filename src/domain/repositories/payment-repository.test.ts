import { describe, it, expect } from "vitest";
import type { CreatePaymentInput } from "./payment-repository";
import { FakePaymentRepository } from "@/test/fakes/payment-repository";



function createPaymentInput(overrides: Partial<CreatePaymentInput> = {}): CreatePaymentInput {
  return {
    itemId: "i1",
    bidderId: "u1",
    bidId: "b1",
    amount: 10000,
    platformFeeCents: 500,
    sellerNetCents: 9500,
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

  it("markCancelled marca o payment como cancelled", async () => {
    const repo = new FakePaymentRepository();
    const created = await repo.createPayment(createPaymentInput());

    const updated = await repo.markCancelled(created.id);

    expect(updated?.status).toBe("cancelled");
    expect(repo.payments[0].status).toBe("cancelled");
  });

  it("markCancelled devolve null para payment inexistente", async () => {
    const repo = new FakePaymentRepository();

    expect(await repo.markCancelled("inexistente")).toBeNull();
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