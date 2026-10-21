import type { PagBankConnectTokens } from "./connect";
import { refreshConnectToken } from "./connect";

// ponytail: provedor de token do vendedor PagBank — o mesmo desenho do MP:
// renovação proativa via refresh_token com margem de 24h. A diferença é que
// o Connect do PagBank devolve um `account_id` explícito, que usamos no split.

export const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;

export function decideRefresh(tokenExpiresAt: Date | null, now: Date): boolean {
  if (tokenExpiresAt === null) return false;
  return tokenExpiresAt.getTime() - now.getTime() <= REFRESH_MARGIN_MS;
}

export interface PagBankSellerCredentials {
  accessToken: string;
  refreshToken: string | null;
  accountId: string | null;
  tokenExpiresAt: Date | null;
}

export async function getValidPagBankAccessToken(
  repo: {
    findCredentials: (userId: string) => Promise<PagBankSellerCredentials | null>;
    upsert: (input: {
      userId: string;
      accessToken: string;
      refreshToken: string | null;
      accountId: string | null;
      tokenExpiresAt: Date | null;
    }) => Promise<unknown>;
  },
  userId: string,
  options?: { now?: Date; refresh?: (token: string) => Promise<PagBankConnectTokens> },
): Promise<string> {
  const now = options?.now ?? new Date();
  const refresh = options?.refresh ?? refreshConnectToken;

  const creds = await repo.findCredentials(userId);
  if (!creds) throw new Error("Vendedor sem conta PagBank conectada");

  if (!decideRefresh(creds.tokenExpiresAt, now)) {
    return creds.accessToken;
  }

  if (creds.refreshToken === null) {
    return creds.accessToken;
  }

  const tokens = await refresh(creds.refreshToken);
  await repo.upsert({
    userId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? creds.refreshToken,
    accountId: tokens.accountId ?? creds.accountId,
    tokenExpiresAt: tokens.tokenExpiresAt,
  });
  return tokens.accessToken;
}
