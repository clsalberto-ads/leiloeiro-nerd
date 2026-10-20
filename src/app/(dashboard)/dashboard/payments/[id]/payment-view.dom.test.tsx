// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/dom-render";
import { PaymentView } from "./payment-view";

// ponytail: a action de status é mockada porque o que este teste prova é o
// COMPORTAMENTO da view com cada resposta — inclusive o polling aprovar o
// pagamento sozinho (o caminho que encerra a espera do usuário).
const mocks = vi.hoisted(() => ({
  getPaymentStatusAction: vi.fn(),
  cancelPaymentFormAction: vi.fn(),
}));

vi.mock("@/presentation/actions/payment-actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/presentation/actions/payment-actions")>()),
  getPaymentStatusAction: mocks.getPaymentStatusAction,
  cancelPaymentFormAction: mocks.cancelPaymentFormAction,
}));

const BASE = {
  paymentId: "0b61e95c-2be1-4d38-8f74-3c5a3a1c8f3a",
  amountCents: 10_000,
  qrCode: "data:image/png;base64,QR",
  pixCopiaECola: "00020126360014br.gov.bcb.pix",
  paymentLink: null,
  deadline: new Date("2026-10-23T12:00:00Z").toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPaymentStatusAction.mockResolvedValue({ ok: true, status: "pending" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PaymentView — pagamento pendente", () => {
  it("mostra QR Code com alt, código copia-e-cola e botão de copiar", () => {
    render(<PaymentView {...BASE} initialStatus="pending" />);

    const qr = screen.getByAltText("QR Code PIX para pagamento do arremate");
    expect(qr.getAttribute("src")).toBe("data:image/png;base64,QR");
    expect(screen.getByText(/00020126360014br\.gov\.bcb\.pix/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /copiar/i })).toBeTruthy();
  });

  it("valor em centavos vira R$ no padrão pt-BR", () => {
    render(<PaymentView {...BASE} initialStatus="pending" />);

    expect(screen.getByText(/R\$ 100,00/)).toBeTruthy();
    expect(screen.getByText("Aguardando pagamento")).toBeTruthy();
  });

  it("copiar usa o clipboard com o código PIX", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<PaymentView {...BASE} initialStatus="pending" />);
    await act(async () => {
      screen.getByRole("button", { name: /copiar/i }).click();
    });

    expect(writeText).toHaveBeenCalledWith(BASE.pixCopiaECola);
  });
});

describe("PaymentView — estados finais", () => {
  it("aprovado: mostra confirmação e NÃO tem botão de cancelar", () => {
    render(<PaymentView {...BASE} initialStatus="approved" />);

    expect(screen.getByText("Pagamento confirmado! O vendedor será notificado do recebimento.")).toBeTruthy();
    expect(screen.queryByText("Cancelar pagamento")).toBeNull();
    expect(screen.getByText("Pago")).toBeTruthy();
  });

  it("cancelado: mensagem própria e sem formulário", () => {
    render(<PaymentView {...BASE} initialStatus="cancelled" />);

    expect(screen.getByText("Você cancelou este pagamento.")).toBeTruthy();
  });
});

describe("PaymentView — polling", () => {
  it("o poll de 10s aprova o pagamento sozinho e PARA de pollar", async () => {
    vi.useFakeTimers();
    mocks.getPaymentStatusAction.mockResolvedValue({ ok: true, status: "approved" });

    render(<PaymentView {...BASE} initialStatus="pending" />);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    // texto completo: `getByText` casa o texto EXATO do elemento, e a frase
    // da confirmação é uma só
    expect(screen.getByText(/Pagamento confirmado!/)).toBeTruthy();
    expect(mocks.getPaymentStatusAction).toHaveBeenCalledTimes(1);

    // aprovado = sem mais polling: o interval foi limpo junto com o estado
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(mocks.getPaymentStatusAction).toHaveBeenCalledTimes(1);
  });
});
