import { createHmac, timingSafeEqual } from "node:crypto";

// ponytail: a validação da assinatura do webhook do Mercado Pago. O header
// `x-signature` chega como `ts=<timestamp>,v1=<hmac>`; o HMAC é SHA256 do
// manifesto `id:<id do pagamento>;request-body:<corpo cru>;` com a
// MERCADO_PAGO_WEBHOOK_SECRET. Duas portas além do hash:
//   1. comparar com `timingSafeEqual` — string equality curto-circuita no
//      primeiro byte diferente e vaza o tamanho do prefixo certo;
//   2. rejeitar timestamps velhos — sem isso, um evento capturado e reenviado
//      ("replay") seria aceito para sempre, porque o hash continua válido.
export const WEBHOOK_TS_TOLERANCE_MS = 10 * 60 * 1000;

export interface MpWebhookSignature {
  ts: number;
  v1: string;
}

export function parseXSignature(header: string | null): MpWebhookSignature | null {
  if (!header) return null;
  const parts = header.split(",").map((p) => p.trim());
  const ts = parts.find((p) => p.startsWith("ts="));
  const v1 = parts.find((p) => p.startsWith("v1="));
  if (!ts || !v1) return null;
  const tsValue = Number(ts.slice(3));
  const v1Value = v1.slice(3);
  if (!Number.isFinite(tsValue) || v1Value === "") return null;
  return { ts: tsValue, v1: v1Value };
}

function hmacSha256(secret: string, manifest: string): string {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return timingSafeEqual(bufA, bufB);
}

/**
 * Valida `x-signature` de um webhook de pagamento.
 *
 * `rawBody` é o corpo EXATAMENTE como chegou (string crua) — reparsing ou
 * re-serialização muda um byte e invalida o hash. `dataId` é o `data.id` do
 * JSON, que entra no manifesto junto.
 */
export function isValidMpWebhookSignature(input: {
  header: string | null;
  rawBody: string;
  dataId: string;
  secret: string;
  now?: number;
}): boolean {
  const signature = parseXSignature(input.header);
  if (!signature) return false;

  const now = input.now ?? Date.now();
  if (Math.abs(now - signature.ts) > WEBHOOK_TS_TOLERANCE_MS) return false;

  const manifest = `id:${input.dataId};request-body:${input.rawBody};`;
  const expected = hmacSha256(input.secret, manifest);
  return safeEqualHex(expected, signature.v1);
}
