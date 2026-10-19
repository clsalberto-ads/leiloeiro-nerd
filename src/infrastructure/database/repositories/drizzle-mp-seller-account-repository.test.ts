import { describe, expect, it } from "vitest";
import { toMpSellerAccount, type MpSellerAccountRow } from "./drizzle-mp-seller-account-repository";

function makeRow(overrides: Partial<MpSellerAccountRow> = {}): MpSellerAccountRow {
  return {
    id: "mpa1",
    userId: "u1",
    accessToken: "APP_USR-secreto",
    refreshToken: "TG-secreta",
    mpUserId: "123",
    tokenExpiresAt: new Date("2027-04-17T12:00:00Z"),
    connectedAt: new Date("2026-10-19T12:00:00Z"),
    updatedAt: new Date("2026-10-19T12:00:00Z"),
    ...overrides,
  };
}

// ponytail: o mapper é o PORTÃO do token. A entidade de domínio não tem o
// campo — e este teste é o que acusa o dia em que alguém "corrige a falta"
// copiando o objeto inteiro, porque o `toEqual` com chaves exatas falha.
describe("toMpSellerAccount", () => {
  it("entrega exatamente os campos de estado — SEM access/refresh token", () => {
    const account = toMpSellerAccount(makeRow());

    expect(account).toEqual({
      id: "mpa1",
      userId: "u1",
      mpUserId: "123",
      tokenExpiresAt: new Date("2027-04-17T12:00:00Z"),
      connectedAt: new Date("2026-10-19T12:00:00Z"),
    });
  });

  it("nenhuma serialização possível da entidade contém o segredo", () => {
    const json = JSON.stringify(toMpSellerAccount(makeRow()));
    expect(json).not.toContain("secreto");
  });

  it("conta mínima (sem mpUserId, sem expiração) mapeia com null", () => {
    const account = toMpSellerAccount(
      makeRow({ mpUserId: null, tokenExpiresAt: null, refreshToken: null }),
    );
    expect(account.mpUserId).toBeNull();
    expect(account.tokenExpiresAt).toBeNull();
  });
});
