import { describe, expect, it } from "vitest";
import { buildMpAuthorizationUrl, parseMpOAuthResponse } from "./oauth";

describe("buildMpAuthorizationUrl", () => {
  it("monta a URL de autorização com client_id, redirect_uri, platform_id e state", () => {
    const url = buildMpAuthorizationUrl(
      { clientId: "APP-123", redirectUri: "http://localhost:3000/api/mercadopago/callback" },
      "state-abc",
    );

    expect(url).toContain("https://auth.mercadopago.com/authorization?");
    const params = new URL(url).searchParams;
    expect(params.get("client_id")).toBe("APP-123");
    expect(params.get("response_type")).toBe("code");
    expect(params.get("platform_id")).toBe("mp");
    expect(params.get("redirect_uri")).toBe("http://localhost:3000/api/mercadopago/callback");
    expect(params.get("state")).toBe("state-abc");
  });
});

describe("parseMpOAuthResponse", () => {
  const now = new Date("2026-10-19T12:00:00Z");

  it("converte access_token, refresh_token, user_id e expires_in (segundos) para data", () => {
    const tokens = parseMpOAuthResponse(
      {
        access_token: "APP_USR-xyz",
        refresh_token: "TG-1",
        user_id: 123456789,
        expires_in: 15_552_000, // 180 dias
      },
      now,
    );

    expect(tokens.accessToken).toBe("APP_USR-xyz");
    expect(tokens.refreshToken).toBe("TG-1");
    expect(tokens.mpUserId).toBe("123456789");
    expect(tokens.tokenExpiresAt?.toISOString()).toBe("2027-04-17T12:00:00.000Z");
  });

  it("refresh_token ausente vira null (a MP pode não devolver em alguns fluxos)", () => {
    const tokens = parseMpOAuthResponse({ access_token: "APP_USR-xyz" }, now);

    expect(tokens.refreshToken).toBeNull();
    expect(tokens.mpUserId).toBeNull();
    expect(tokens.tokenExpiresAt).toBeNull();
  });

  it("recusa resposta sem access_token — nunca gravamos uma conexão sem token", () => {
    expect(() => parseMpOAuthResponse({}, now)).toThrow();
    expect(() => parseMpOAuthResponse({ access_token: "" }, now)).toThrow();
    expect(() => parseMpOAuthResponse("não é objeto", now)).toThrow();
  });
});
