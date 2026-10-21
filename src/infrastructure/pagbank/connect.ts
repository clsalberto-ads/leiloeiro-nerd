import { pagBankRequest } from "./client";

// ponytail: Connect OAuth do PagBank — o equivalente ao OAuth da MP para
// conectar vendedores. O vendedor autoriza a plataforma a criar pagamentos
// em nome dele; a troca do code por tokens é 100% server-side.
//
// O Connect do PagBank é DIFERENTE da MP em dois pontos:
// 1. A URL de autorização não é um domínio separado como auth.mercadopago.com
//    — o Connect Authorization redireciona dentro do próprio portal PagBank.
// 2. O token retornado tem `account_id` explícito — é o identificador da
//    conta do vendedor dentro do PagBank, que usamos no split.

export interface PagBankConnectConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function pagBankConnectConfig(): PagBankConnectConfig {
  const clientId = process.env.PAGBANK_CLIENT_ID;
  const clientSecret = process.env.PAGBANK_CLIENT_SECRET;
  const redirectUri = process.env.PAGBANK_CONNECT_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "PAGBANK_CLIENT_ID/CLIENT_SECRET/CONNECT_REDIRECT_URI ausentes: configure o Connect no .env",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

/** URL de autorização para a qual o vendedor é levado ao clicar em "Conectar". */
export function buildConnectAuthorizationUrl(state: string): string {
  const config = pagBankConnectConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "payments:read payments:write",
    state,
  });
  return `https://connect.pagbank.com.br/oauth/authorize?${params.toString()}`;
}

export interface PagBankConnectTokens {
  accessToken: string;
  refreshToken: string | null;
  accountId: string | null;
  tokenExpiresAt: Date | null;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  account_id?: string;
  expires_in?: number;
  token_type?: string;
}

export function parseConnectResponse(raw: unknown, now = new Date()): PagBankConnectTokens {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Resposta Connect do PagBank inválida");
  }
  const body = raw as TokenResponse;
  if (typeof body.access_token !== "string" || body.access_token === "") {
    throw new Error("Resposta Connect sem access_token");
  }
  return {
    accessToken: body.access_token,
    refreshToken:
      typeof body.refresh_token === "string" && body.refresh_token !== "" ? body.refresh_token : null,
    accountId: body.account_id ?? null,
    tokenExpiresAt:
      typeof body.expires_in === "number" && Number.isFinite(body.expires_in)
        ? new Date(now.getTime() + body.expires_in * 1000)
        : null,
  };
}

/** Troca o code do callback pelos tokens do vendedor (Connect). */
export async function exchangeConnectCode(code: string): Promise<PagBankConnectTokens> {
  const config = pagBankConnectConfig();
  const res = await pagBankRequest<TokenResponse>({
    path: "/connect/oauth/token",
    method: "POST",
    accessToken: "", // o endpoint de token não exige Bearer; envia no body
    body: {
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    },
  });
  return parseConnectResponse(res);
}

/** Renova o access token com o refresh token. */
export async function refreshConnectToken(refreshToken: string): Promise<PagBankConnectTokens> {
  const config = pagBankConnectConfig();
  const res = await pagBankRequest<TokenResponse>({
    path: "/connect/oauth/token",
    method: "POST",
    accessToken: "",
    body: {
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    },
  });
  return parseConnectResponse(res);
}
