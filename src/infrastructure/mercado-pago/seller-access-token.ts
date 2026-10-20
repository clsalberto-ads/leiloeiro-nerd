import type { MpSellerAccountRepository } from "@/domain/repositories/mp-seller-account-repository";
import { refreshMpAccessToken, type MpOAuthTokens } from "./oauth";

// ponytail: RENOVAÇÃO do token do vendedor. O access token da MP vive ~180
// dias; sem isto, todo vendedor que conectou a conta e voltou meio ano depois
// quebraria na hora de receber o pagamento dele. A renovação é server-side
// (refresh_token) e TRANSPARENTE para quem paga e para quem recebe.

/** Margem de segurança: renova quando faltam menos de 24h, não na hora exata. */
export const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;

/**
 * Decide se o token precisa de renovação.
 *
 * `expiresAt` nulo = a MP não devolveu `expires_in`: sem informação, usa o
 * token como está (arriscar a chamada é melhor que recusar o pagamento por um
 * campo opcional que faltou). A falha real do token vira erro da chamada de
 * pagamento, com o status da MP no texto.
 */
export function decideRefresh(tokenExpiresAt: Date | null, now: Date): boolean {
  if (tokenExpiresAt === null) return false;
  return tokenExpiresAt.getTime() - now.getTime() <= REFRESH_MARGIN_MS;
}

/**
 * O token de acesso VÁLIDO do vendedor, renovando se estiver perto de expirar.
 * `null` da credencial → erro claro ("sem conta conectada") — quem chama decide
 * se é 4xx amigável (action do seller) ou log do worker.
 *
 * `refresh` e `now` são injetáveis: o teste não espera 180 dias nem rede.
 */
export async function getValidSellerAccessToken(
  repo: Pick<MpSellerAccountRepository, "findCredentials" | "findByUserId" | "upsert">,
  userId: string,
  options?: { now?: Date; refresh?: (token: string) => Promise<MpOAuthTokens> },
): Promise<string> {
  const now = options?.now ?? new Date();
  const refresh = options?.refresh ?? refreshMpAccessToken;

  const [credentials, account] = await Promise.all([
    repo.findCredentials(userId),
    repo.findByUserId(userId),
  ]);
  if (!credentials) {
    throw new Error("Vendedor sem conta Mercado Pago conectada");
  }

  if (!decideRefresh(credentials.tokenExpiresAt, now)) {
    return credentials.accessToken;
  }

  if (credentials.refreshToken === null) {
    // Expirando/expire sem refresh token: nada a fazer além de tentar com o
    // que temos — a MP recusa e a mensagem dela chega no log da chamada.
    return credentials.accessToken;
  }

  const tokens = await refresh(credentials.refreshToken);
  await repo.upsert({
    userId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? credentials.refreshToken,
    // A resposta da renovação traz o user_id da conta; se não trouxer, o que
    // já estava gravado continua — reconectar identidade não é papel do refresh.
    mpUserId: tokens.mpUserId ?? account?.mpUserId ?? null,
    tokenExpiresAt: tokens.tokenExpiresAt,
  });
  return tokens.accessToken;
}
