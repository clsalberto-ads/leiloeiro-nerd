import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzlePagBankSellerAccountRepository } from "@/infrastructure/database/repositories/drizzle-pagbank-seller-account-repository";
import { exchangeConnectCode } from "@/infrastructure/pagbank/connect";

export async function GET(request: Request): Promise<Response> {
  const jar = await cookies();
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = jar.get("pagbank_oauth_state")?.value;

  jar.delete("pagbank_oauth_state");

  const back = (result: string): never =>
    redirect(`/dashboard/settings?pagbank=${result}`);

  if (error) return back("erro-autorizacao");
  if (!code || !state) return back("erro-callback");

  const session = await getSession();
  if (!session) return back("erro-sessao");
  if (!expectedState || expectedState !== state) return back("erro-state");

  try {
    const tokens = await exchangeConnectCode(code);
    await drizzlePagBankSellerAccountRepository.upsert({
      userId: session.user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accountId: tokens.accountId,
      tokenExpiresAt: tokens.tokenExpiresAt,
    });
  } catch (err) {
    console.error("[pagbank/callback] Falha ao trocar code por tokens:", err);
    return back("erro-troca");
  }

  return back("conectado");
}
