import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isValidMpWebhookSignature,
  parseXSignature,
  WEBHOOK_TS_TOLERANCE_MS,
} from "./webhook-signature";

const SECRET = "segredo-do-webhook";
const RAW_BODY = JSON.stringify({ type: "payment", data: { id: "123456" } });
const DATA_ID = "123456";
const NOW = 1_700_000_000_000;

function signedHeader(offsetMs = 0): string {
  const ts = NOW + offsetMs;
  const manifest = `id:${DATA_ID};request-body:${RAW_BODY};`;
  const v1 = createHmac("sha256", SECRET).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("parseXSignature", () => {
  it("lê ts e v1 no formato que a MP envia", () => {
    expect(parseXSignature("ts=123,v1=abc")).toEqual({ ts: 123, v1: "abc" });
  });

  it("recusa header ausente, incompleto ou com ts não numérico", () => {
    expect(parseXSignature(null)).toBeNull();
    expect(parseXSignature("ts=123")).toBeNull();
    expect(parseXSignature("v1=abc")).toBeNull();
    expect(parseXSignature("ts=abc,v1=def")).toBeNull();
    expect(parseXSignature("ts=123,v1=")).toBeNull();
  });
});

describe("isValidMpWebhookSignature", () => {
  it("aceita assinatura válida recém-gerada", () => {
    expect(
      isValidMpWebhookSignature({
        header: signedHeader(),
        rawBody: RAW_BODY,
        dataId: DATA_ID,
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("recusa assinatura de outro segredo (secret errado no .env)", () => {
    expect(
      isValidMpWebhookSignature({
        header: signedHeader(),
        rawBody: RAW_BODY,
        dataId: DATA_ID,
        secret: "outro-segredo",
        now: NOW,
      }),
    ).toBe(false);
  });

  it("recusa corpo adulterado (o hash cobre o corpo cru inteiro)", () => {
    expect(
      isValidMpWebhookSignature({
        header: signedHeader(),
        rawBody: RAW_BODY.replace("123456", "999999"),
        dataId: DATA_ID,
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("recusa id trocado no manifesto (payload de outro pagamento)", () => {
    expect(
      isValidMpWebhookSignature({
        header: signedHeader(),
        rawBody: RAW_BODY,
        dataId: "999999",
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("recusa replay fora da tolerância de tempo", () => {
    const stale = WEBHOOK_TS_TOLERANCE_MS + 60_000;
    expect(
      isValidMpWebhookSignature({
        header: signedHeader(-stale),
        rawBody: RAW_BODY,
        dataId: DATA_ID,
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("header ausente não valida", () => {
    expect(
      isValidMpWebhookSignature({
        header: null,
        rawBody: RAW_BODY,
        dataId: DATA_ID,
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });
});
