import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ponytail: o `notFound` é mockado LANÇANDO (o que o Next faz), o mesmo
// desenho do redirect nos testes das outras páginas — sem isso o teste
// provaria uma página que continua renderizando depois do 404.
const spy = vi.hoisted(() => {
  class NotFound extends Error {
    constructor() {
      super("NEXT_NOT_FOUND");
    }
  }
  return { NotFound, notFoundCalls: 0 as number, session: vi.fn(), findPayment: vi.fn(), findItem: vi.fn() };
});

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: (): never => {
    spy.notFoundCalls += 1;
    throw new spy.NotFound();
  },
}));

vi.mock("@/presentation/actions/auth-actions", () => ({ getSession: spy.session }));
vi.mock("@/infrastructure/database/repositories/drizzle-payment-repository", () => ({
  drizzlePaymentRepository: { findById: spy.findPayment },
}));
vi.mock("@/infrastructure/database/repositories/drizzle-item-repository", () => ({
  drizzleItemRepository: { findById: spy.findItem },
}));

// ponytail: o PaymentView é CLIENT (sonner, polling, clipboard) e tem o
// PRÓPRIO teste DOM; aqui ele é trocado por um marcador para o teste da página
// provar guards e dados, sem re-testar a view.
vi.mock("./payment-view", () => ({
  PaymentView: () => <div data-testid="payment-view" />,
}));

import PaymentPage from "./page";

const UUID = "0b61e95c-2be1-4d38-8f74-3c5a3a1c8f3a";

const PAYMENT = {
  id: UUID,
  itemId: "i1",
  bidderId: "bidder-1",
  amount: 10_000,
  status: "pending",
  pixQrCode: "data:image/png;base64,QR",
  pixCopiaECola: "000201PIX",
  paymentLink: null,
  deadline: new Date("2026-10-23T12:00:00Z"),
};

async function renderPage(id: string) {
  // ponytail: o `await` NA PÁGINA antes do render é o padrão dos testes de
  // página deste repo (notifications/page.test.tsx): a página é um componente
  // assíncrono, e renderizá-la sem resolver a deixa suspensa no
  // `renderToStaticMarkup` — que não sabe o que fazer com a suspensão.
  return renderToStaticMarkup(
    await PaymentPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({}),
    }),
  );
}

describe("payments/[id] — privacidade e guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spy.notFoundCalls = 0;
    spy.session.mockResolvedValue({ user: { id: "bidder-1" } });
    spy.findPayment.mockResolvedValue(PAYMENT);
    spy.findItem.mockResolvedValue({ id: "i1", title: "Console raro" });
  });

  it("id fora do formato uuid é 404 sem consultar nada", async () => {
    await expect(renderPage("nao-uuid")).rejects.toThrow(spy.NotFound);
    expect(spy.findPayment).not.toHaveBeenCalled();
  });

  it("sem sessão é 404 — pagamento não é página pública", async () => {
    spy.session.mockResolvedValue(null);
    await expect(renderPage(UUID)).rejects.toThrow(spy.NotFound);
  });

  it("pagamento de OUTRA pessoa é 404 — sem revelar que existe", async () => {
    spy.session.mockResolvedValue({ user: { id: "outra-pessoa" } });
    await expect(renderPage(UUID)).rejects.toThrow(spy.NotFound);
  });

  it("pagamento inexistente é 404", async () => {
    spy.findPayment.mockResolvedValue(null);
    await expect(renderPage(UUID)).rejects.toThrow(spy.NotFound);
  });

  it("o dono vê a página com o título do item", async () => {
    const html = await renderPage(UUID);

    expect(spy.notFoundCalls).toBe(0);
    expect(html).toContain("Console raro");
    expect(html).toContain("data-testid=\"payment-view\"");
  });
});
