import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handlePaymentWebhook: vi.fn(),
}));

vi.mock("@/application/use-cases/handle-payment-webhook", () => ({
  handlePaymentWebhook: mocks.handlePaymentWebhook,
}));

import { POST } from "./route";
import { resetRateLimits } from "@/lib/rate-limit";

const SECRET = "segredo-do-webhook";

function makeRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/webhooks/mercadopago", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function signatureFor(body: string, dataId: string, secret: string): string {
  const manifest = `id:${dataId};request-body:${body};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${Date.now()},v1=${v1}`;
}

const VALID_BODY = JSON.stringify({ type: "payment", data: { id: "123456" } });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = SECRET;
  mocks.handlePaymentWebhook.mockResolvedValue({ result: "ignored", reason: "payment-not-found" });
});

describe("POST /api/webhooks/mercadopago", () => {
  it("corpo que não é JSON é 400", async () => {
    const res = await POST(makeRequest("não é json"));
    expect(res.status).toBe(400);
  });

  it("sem data.id é 400", async () => {
    const res = await POST(makeRequest(JSON.stringify({ type: "payment" })));
    expect(res.status).toBe(400);
  });

  it("sem assinatura é 401 — e o use case NUNCA roda", async () => {
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(401);
    expect(mocks.handlePaymentWebhook).not.toHaveBeenCalled();
  });

  it("assinatura de outro segredo é 401", async () => {
    const res = await POST(
      makeRequest(VALID_BODY, { "x-signature": signatureFor(VALID_BODY, "123456", "errado") }),
    );

    expect(res.status).toBe(401);
  });

  it("assinatura válida de webhook de pagamento processa e responde 200", async () => {
    const res = await POST(
      makeRequest(VALID_BODY, { "x-signature": signatureFor(VALID_BODY, "123456", SECRET) }),
    );

    expect(res.status).toBe(200);
    expect(mocks.handlePaymentWebhook).toHaveBeenCalledWith(expect.anything(), "123456");
  });

  it("webhook válido de outro TIPO é 200 e descartado sem processar", async () => {
    const body = JSON.stringify({ type: "topic", data: { id: "x" } });
    const res = await POST(makeRequest(body, { "x-signature": signatureFor(body, "x", SECRET) }));

    expect(res.status).toBe(200);
    expect(mocks.handlePaymentWebhook).not.toHaveBeenCalled();
  });

  it("falha transitória do use case é 500 — a MP reenvia", async () => {
    mocks.handlePaymentWebhook.mockRejectedValue(new Error("rede caiu"));
    const res = await POST(
      makeRequest(VALID_BODY, { "x-signature": signatureFor(VALID_BODY, "123456", SECRET) }),
    );

    expect(res.status).toBe(500);
  });

  it("resultado ignorado também é 200: a MP não precisa reenviar", async () => {
    const res = await POST(
      makeRequest(VALID_BODY, { "x-signature": signatureFor(VALID_BODY, "123456", SECRET) }),
    );

    expect(res.status).toBe(200);
  });
});

// ponytail: o teto de 100/min por IP (spec §3.7). A assinatura é válida —
// o que se prova aqui é que VOLUME é recusado antes de processar.
describe("rate limit do webhook", () => {
  it("excedendo 100 req/min por IP, a 101ª responde 429 sem processar", async () => {
    mocks.handlePaymentWebhook.mockClear();
    // 100 chamadas legítimas (corpo e assinatura válidos)
    for (let i = 0; i < 100; i += 1) {
      const res = await POST(
        makeRequest(VALID_BODY, { "x-signature": signatureFor(VALID_BODY, "123456", SECRET) }),
      );
      expect(res.status).toBe(200);
    }
    // a 101ª: recusada pelo teto
    const res = await POST(
      makeRequest(VALID_BODY, { "x-signature": signatureFor(VALID_BODY, "123456", SECRET) }),
    );
    expect(res.status).toBe(429);
    expect(mocks.handlePaymentWebhook).toHaveBeenCalledTimes(100);
  });
});
