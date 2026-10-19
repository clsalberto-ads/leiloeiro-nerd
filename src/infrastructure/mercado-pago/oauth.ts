// ponytail: OAuth do Mercado Pago (modelo marketplace). O vendedor autoriza a
// plataforma a criar pagamentos NA CONTA DELE; a troca do `code` por tokens é
// 100% server-side — o `CLIENT_SECRET` e os tokens nunca passam pelo navegador.
//
// As duas funções PURAS (`buildMpAuthorizationUrl`, `parseMpOAuthResponse`)
// carregam a lógica e são testadas; as duas HTTP são invólucros finos da API.
const MP_AUTHORIZATION_URL = "https://auth.mercadopago.com/authorization";
const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";

/** Configuração obrigatória do App Mercado Pago da PLATAFORMA. */
export interface MpOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function mpOAuthConfig(): MpOAuthConfig {
  const clientId = process.env.MERCADO_PAGO_CLIENT_ID;
  const clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET;
  const redirectUri = process.env.MERCADO_PAGO_REDIRECT_URI;
  // Falhar alto na inicialização do fluxo — a configuração ausente só
  // apareceria no clique do vendedor, com um erro de rede sem contexto.
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "MERCADO_PAGO_CLIENT_ID/CLIENT_SECRET/REDIRECT_URI ausentes: configure o App Mercado Pago da plataforma no .env antes de conectar vendedores",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

/** URL de autorização para a qual o vendedor é levado ao clicar em "Conectar". */
export function buildMpAuthorizationUrl(
  config: Pick<MpOAuthConfig, "clientId" | "redirectUri">,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    platform_id: "mp",
    redirect_uri: config.redirectUri,
    state,
  });
  return `${MP_AUTHORIZATION_URL}?${params.toString()}`;
}

/** Tokens de uma resposta OAuth da MP, com a expiração calculada. */
export interface MpOAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  mpUserId: string | null;
  tokenExpiresAt: Date | null;
}

/**
 * Converte a resposta JSON da MP (`oauth/token`) nos campos que gravamos.
 *
 * `expires_in` vem em SEGUNDOS (~15.552.000 = 180 dias). A data de expiração é
 * calculada com o `now` injetável — determinística no teste.
 */
export function parseMpOAuthResponse(raw: unknown, now = new Date()): MpOAuthTokens {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Resposta OAuth do Mercado Pago inválida");
  }
  const body = raw as {
    access_token?: unknown;
    refresh_token?: unknown;
    user_id?: unknown;
    expires_in?: unknown;
  };
  if (typeof body.access_token !== "string" || body.access_token === "") {
    throw new Error("Resposta OAuth do Mercado Pago sem access_token");
  }
  const refreshToken =
    typeof body.refresh_token === "string" && body.refresh_token !== ""
      ? body.refresh_token
      : null;
  const tokenExpiresAt =
    typeof body.expires_in === "number" && Number.isFinite(body.expires_in)
      ? new Date(now.getTime() + body.expires_in * 1000)
      : null;
  return {
    accessToken: body.access_token,
    refreshToken,
    mpUserId: body.user_id == null ? null : String(body.user_id),
    tokenExpiresAt,
  };
}

async function postForTokens(payload: Record<string, string>): Promise<MpOAuthTokens> {
  const res = await fetch(MP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // O corpo da MP descreve o motivo (bad_request, invalid_grant…); ele vai no
    // log do servidor, não para o vendedor.
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Falha na chamada OAuth ao Mercado Pago (HTTP ${res.status}): ${detail.slice(0, 300)}`,
    );
  }
  return parseMpOAuthResponse(await res.json());
}

/** Troca o `code` do callback pelos tokens do vendedor (uma única vez). */
export async function exchangeMpCodeForTokens(code: string): Promise<MpOAuthTokens> {
  const config = mpOAuthConfig();
  return postForTokens({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  });
}

/** Renova o access token com o refresh_token — sem pedir nova autorização. */
export async function refreshMpAccessToken(refreshToken: string): Promise<MpOAuthTokens> {
  const config = mpOAuthConfig();
  return postForTokens({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });
}
