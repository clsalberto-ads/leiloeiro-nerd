import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzleMpSellerAccountRepository } from "@/infrastructure/database/repositories/drizzle-mp-seller-account-repository";
import { exchangeMpCodeForTokens } from "@/infrastructure/mercado-pago/oauth";

// ponytail: o callback do OAuth é onde o `code` de UM vendedor vira os tokens
// dele. Tudo aqui é defensivo porque a URL é pública (a MP redireciona para
// ela de um navegador qualquer): sem sessão, sem state válido ou sem `code`,
// o vendedor volta para as configurações com um erro legível — nunca com um
// stack trace, e nunca com tokens gravados de uma requisição forjada.
export async function GET(request: Request): Promise<Response> {
  const jar = await cookies();
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = jar.get("mp_oauth_state")?.value;

  // O cookie é de UM uso: consumido no primeiro callback, forjado ou não.
  jar.delete("mp_oauth_state");

  const back = (result: string): never =>
    redirect(`/dashboard/settings?mercadopago=${result}`);

  if (error) return back("erro-autorizacao");
  if (!code || !state) return back("erro-callback");

  const session = await getSession();
  if (!session) return back("erro-sessao");

  // Sem a correspondência exata do state, o `code` não é confiável — pode ser
  // o code de um fluxo iniciado por outra pessoa/outra aba.
  if (!expectedState || expectedState !== state) return back("erro-state");

  try {
    const tokens = await exchangeMpCodeForTokens(code);
    await drizzleMpSellerAccountRepository.upsert({
      userId: session.user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      mpUserId: tokens.mpUserId,
      tokenExpiresAt: tokens.tokenExpiresAt,
    });
  } catch (err) {
    console.error("[mercadopago/callback] Falha ao trocar code por tokens:", err);
    return back("erro-troca");
  }

  return back("conectado");
}
