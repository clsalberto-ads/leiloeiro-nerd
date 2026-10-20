import { describe, expect, it } from "vitest";
import { decideRefresh, getValidSellerAccessToken, REFRESH_MARGIN_MS } from "./seller-access-token";
import type { MpSellerAccountRepository } from "@/domain/repositories/mp-seller-account-repository";
import type { MpOAuthTokens } from "./oauth";

const NOW = new Date("2026-10-20T12:00:00Z");

describe("decideRefresh", () => {
  it("token válido e longe de expirar NÃO renova", () => {
    const expires = new Date(NOW.getTime() + REFRESH_MARGIN_MS + 60_000);
    expect(decideRefresh(expires, NOW)).toBe(false);
  });

  it("dentro da margem de 24h renova (na hora exata é tarde demais)", () => {
    const expires = new Date(NOW.getTime() + REFRESH_MARGIN_MS - 60_000);
    expect(decideRefresh(expires, NOW)).toBe(true);
  });

  it("expirado renova", () => {
    expect(decideRefresh(new Date(NOW.getTime() - 1000), NOW)).toBe(true);
  });

  it("sem data de expiração usa o token como está (sem informação, sem chute)", () => {
    expect(decideRefresh(null, NOW)).toBe(false);
  });
});

function makeRepo(
  credentials: { accessToken: string; refreshToken: string | null; tokenExpiresAt: Date | null } | null,
) {
  const upserts: unknown[] = [];
  const repo: Pick<MpSellerAccountRepository, "findCredentials" | "findByUserId" | "upsert"> = {
    async findCredentials() {
      return credentials;
    },
    async findByUserId() {
      return credentials
        ? { id: "mpa1", userId: "u1", mpUserId: "999", tokenExpiresAt: credentials.tokenExpiresAt, connectedAt: NOW }
        : null;
    },
    async upsert(input) {
      upserts.push(input);
      return { id: "mpa1", userId: "u1", mpUserId: "999", tokenExpiresAt: null, connectedAt: NOW };
    },
  };
  return { repo, upserts };
}

describe("getValidSellerAccessToken", () => {
  const tokens = (accessToken: string): MpOAuthTokens => ({
    accessToken,
    refreshToken: "novo-refresh",
    mpUserId: "999",
    tokenExpiresAt: new Date("2027-04-17T12:00:00Z"),
  });

  it("vendedor sem conta conectada é erro claro", async () => {
    const { repo } = makeRepo(null);
    await expect(getValidSellerAccessToken(repo, "u1", { now: NOW })).rejects.toThrow(
      "conta Mercado Pago conectada",
    );
  });

  it("token válido é devolvido SEM renovação", async () => {
    const { repo, upserts } = makeRepo({
      accessToken: "APP_USR-valido",
      refreshToken: "TG-1",
      tokenExpiresAt: new Date(NOW.getTime() + REFRESH_MARGIN_MS + 60_000),
    });

    const token = await getValidSellerAccessToken(repo, "u1", { now: NOW });
    expect(token).toBe("APP_USR-valido");
    expect(upserts).toHaveLength(0);
  });

  it("token expirando é renovado com o refresh_token e o novo par é GRAVADO", async () => {
    const { repo, upserts } = makeRepo({
      accessToken: "APP_USR-velho",
      refreshToken: "TG-1",
      tokenExpiresAt: new Date(NOW.getTime() - 1000),
    });

    const token = await getValidSellerAccessToken(repo, "u1", {
      now: NOW,
      refresh: async (r) => {
        expect(r).toBe("TG-1");
        return tokens("APP_USR-novo");
      },
    });

    expect(token).toBe("APP_USR-novo");
    expect(upserts).toMatchObject([{ userId: "u1", accessToken: "APP_USR-novo", mpUserId: "999" }]);
  });

  it("expirando SEM refresh token: usa o token que tem (a MP decide na chamada)", async () => {
    const { repo, upserts } = makeRepo({
      accessToken: "APP_USR-sem-refresh",
      refreshToken: null,
      tokenExpiresAt: new Date(NOW.getTime() - 1000),
    });

    const token = await getValidSellerAccessToken(repo, "u1", { now: NOW });
    expect(token).toBe("APP_USR-sem-refresh");
    expect(upserts).toHaveLength(0);
  });
});
