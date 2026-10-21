import { createHmac, randomUUID } from "node:crypto";

// ponytail: o cliente HTTP base do PagBank. Toda chamada carrega o Bearer
// token (da plataforma OU do vendedor via Connect) e o X-Idempotency-Key
// (retries seguros — o PagBank deduplica por esta chave).
//
// Duas URLs: produção e sandbox. O sandbox é um AMBIENTE SEPARADO com
// credenciais próprias — não é um "token de teste" na mesma URL como na MP.
// A PAGBANK_API_URL decide qual; o token TEM de casar com o ambiente.

export function pagBankApiUrl(): string {
  return process.env.PAGBANK_API_URL ?? "https://api.pagbank.com.br";
}

export function pagBankSandboxUrl(): string {
  return process.env.PAGBANK_SANDBOX_URL ?? "https://sandbox.api.pagbank.com";
}

/** A URL ativa: sandbox quando PAGBANK_USE_SANDBOX=true, produção senão. */
export function activeApiUrl(): string {
  return process.env.PAGBANK_USE_SANDBOX === "true"
    ? pagBankSandboxUrl()
    : pagBankApiUrl();
}

export interface PagBankRequest {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  accessToken: string;
  body?: unknown;
  query?: Record<string, string>;
}

export async function pagBankRequest<T>(req: PagBankRequest): Promise<T> {
  const url = new URL(req.path, activeApiUrl());
  if (req.query) {
    for (const [k, v] of Object.entries(req.query)) url.searchParams.set(k, v);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${req.accessToken}`,
    "Content-Type": "application/json",
  };
  if (req.method === "POST") {
    headers["X-Idempotency-Key"] = randomUUID();
  }

  const res = await fetch(url.toString(), {
    method: req.method,
    headers,
    body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`PagBank ${req.path} → HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }

  return res.json() as Promise<T>;
}

// ─── Webhook signature ────────────────────────────────────────────────────

// ponytail: o PagBank assina webhooks com X-PagBank-Signature (HMAC-SHA256
// do corpo com o PAGBANK_WEBHOOK_SECRET). A validação é timing-safe, igual
// ao guard da MP — mas o formato do header é mais simples: UMA string
// hex, sem prefixo "v1=".
export function isValidPagBankWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
}): boolean {
  if (!input.signatureHeader) return false;
  const expected = createHmac("sha256", input.secret).update(input.rawBody).digest("hex");
  const received = input.signatureHeader.trim();
  return timingSafeEqualHex(expected, received);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.equals(bufB) && bufA.length > 0;
}
