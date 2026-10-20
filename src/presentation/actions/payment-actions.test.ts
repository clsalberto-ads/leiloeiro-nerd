import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  createPayment: vi.fn(),
  findById: vi.fn(),
  findPayment: vi.fn(),
  markCancelled: vi.fn(),
}));

vi.mock("./auth-actions", () => ({ getSession: mocks.getSession }));
vi.mock("@/application/use-cases/create-payment", () => ({ createPayment: mocks.createPayment }));
vi.mock("@/infrastructure/database/repositories/drizzle-item-repository", () => ({
  drizzleItemRepository: { findById: mocks.findById },
}));
vi.mock("@/infrastructure/database/repositories/drizzle-payment-repository", () => ({
  drizzlePaymentRepository: { findById: mocks.findPayment, markCancelled: mocks.markCancelled },
}));
// as dependências de infraestrutura do MP não são exercitadas nestes guards:
// o que se prova aqui é a AUTORIZAÇÃO, e ela não depende do provedor.
vi.mock("@/infrastructure/database/repositories/drizzle-bid-repository", () => ({ drizzleBidRepository: {} }));
vi.mock("@/infrastructure/database/repositories/drizzle-user-repository", () => ({ drizzleUserRepository: {} }));
vi.mock("@/infrastructure/database/repositories/drizzle-notification-repository", () => ({ drizzleNotificationRepository: {} }));
vi.mock("@/infrastructure/database/repositories/drizzle-mp-seller-account-repository", () => ({ drizzleMpSellerAccountRepository: {} }));
vi.mock("@/infrastructure/mercado-pago/payments", () => ({
  createMpPixPayment: vi.fn(),
  createMpCheckoutPreference: vi.fn(),
}));
vi.mock("@/infrastructure/mercado-pago/seller-access-token", () => ({
  getValidSellerAccessToken: vi.fn(),
}));

import {
  cancelPaymentAction,
  createPaymentAction,
  getPaymentStatusAction,
} from "./payment-actions";

const UUID_VALIDO = "0b61e95c-2be1-4d38-8f74-3c5a3a1c8f3a";

const CLOSED_ITEM = {
  id: UUID_VALIDO,
  sellerId: "seller-1",
  status: "closed",
};

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID_VALIDO,
    itemId: "i1",
    bidderId: "bidder-1",
    status: "pending",
    pixQrCode: "data:image/png;base64,QR",
    pixCopiaECola: "000201PIX",
    paymentLink: null,
    deadline: new Date("2026-10-23T12:00:00Z"),
    reminderSentAt: null,
    ...overrides,
  };
}

describe("payment-actions — autorização", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "seller-1" } });
  });

  describe("createPaymentAction (seller dono do item)", () => {
    it("sem sessão não gera cobrança", async () => {
      mocks.getSession.mockResolvedValue(null);
      await expect(createPaymentAction(UUID_VALIDO)).resolves.toMatchObject({
        error: "Não autenticado",
      });
      expect(mocks.createPayment).not.toHaveBeenCalled();
    });

    it("id fora do formato uuid é recusado antes de qualquer consulta", async () => {
      await expect(createPaymentAction("não-é-uuid")).resolves.toMatchObject({
        error: "Item inválido",
      });
      expect(mocks.findById).not.toHaveBeenCalled();
    });

    it("vendedor que não é o dono do item não gera cobrança", async () => {
      mocks.findById.mockResolvedValue({ ...CLOSED_ITEM, sellerId: "outro-vendedor" });

      await expect(createPaymentAction(UUID_VALIDO)).resolves.toMatchObject({
        error: "Sem permissão",
      });
      expect(mocks.createPayment).not.toHaveBeenCalled();
    });

    it("o dono gera a cobrança e recebe o id do pagamento", async () => {
      mocks.findById.mockResolvedValue(CLOSED_ITEM);
      mocks.createPayment.mockResolvedValue({ id: "pay-1" });

      await expect(createPaymentAction(UUID_VALIDO)).resolves.toEqual({
        ok: true,
        paymentId: "pay-1",
      });
    });

    it("erro do use case (ex.: vendedor sem conta MP) vira mensagem, não exceção", async () => {
      mocks.findById.mockResolvedValue(CLOSED_ITEM);
      mocks.createPayment.mockRejectedValue(new Error("Vendedor sem conta Mercado Pago conectada"));

      await expect(createPaymentAction(UUID_VALIDO)).resolves.toMatchObject({
        error: "Vendedor sem conta Mercado Pago conectada",
      });
    });
  });

  describe("getPaymentStatusAction (arrematante dono do pagamento)", () => {
    it("devolve status, QR e copia-e-cola para o dono", async () => {
      mocks.getSession.mockResolvedValue({ user: { id: "bidder-1" } });
      mocks.findPayment.mockResolvedValue(payment());

      const res = await getPaymentStatusAction(UUID_VALIDO);
      expect(res).toMatchObject({
        ok: true,
        status: "pending",
        qrCode: "data:image/png;base64,QR",
        pixCopiaECola: "000201PIX",
      });
    });

    it("pagamento de outra pessoa é 'não encontrado' — sem vazar dados", async () => {
      mocks.getSession.mockResolvedValue({ user: { id: "outra-pessoa" } });
      mocks.findPayment.mockResolvedValue(payment());

      await expect(getPaymentStatusAction(UUID_VALIDO)).resolves.toMatchObject({
        error: "Pagamento não encontrado",
      });
    });
  });

  describe("cancelPaymentAction (arrematante dono do pagamento)", () => {
    it("dono cancela pagamento pendente", async () => {
      mocks.getSession.mockResolvedValue({ user: { id: "bidder-1" } });
      mocks.findPayment.mockResolvedValue(payment());
      mocks.markCancelled.mockResolvedValue(payment({ status: "cancelled" }));

      await expect(cancelPaymentAction(UUID_VALIDO)).resolves.toEqual({ ok: true });
    });

    it("pagamento já aprovado não pode ser cancelado", async () => {
      mocks.getSession.mockResolvedValue({ user: { id: "bidder-1" } });
      mocks.findPayment.mockResolvedValue(payment({ status: "approved" }));

      await expect(cancelPaymentAction(UUID_VALIDO)).resolves.toMatchObject({
        error: "Só é possível cancelar um pagamento pendente",
      });
      expect(mocks.markCancelled).not.toHaveBeenCalled();
    });
  });
});
