"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzleMpSellerAccountRepository } from "@/infrastructure/database/repositories/drizzle-mp-seller-account-repository";
import { buildMpAuthorizationUrl, mpOAuthConfig } from "@/infrastructure/mercado-pago/oauth";

// ponytail: o `state` do OAuth é o anti-CSRF do fluxo inteiro. Sem ele, um
// link forjado "conectar" poderia amarrar a conta de OUTRO vendedor MP à sessão
// da vítima — o callback gravaria o token do atacante na conta do vendedor, e
// os pagamentos dos arremates iriam para a conta errada. O valor aleatório
// vive num cookie httpOnly de 10 minutos e o callback recusa qualquer
// divergência.
const STATE_COOKIE = "mp_oauth_state";
const STATE_TTL_MS = 10 * 60 * 1000;

function randomState(): string {
  return crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
}

export async function connectMercadoPagoAction(): Promise<void> {
  const session = await getSession();
  if (!session) return;

  // ponytail: a conexão da conta MP é exclusividade de quem VENDE — o mesmo
  // gate de `createItem`/`uploadItemImages`. Um comprador conectando conta MP
  // não tem o que receber: é ruído na tabela e na UI.
  if (session.user.role !== "seller" && session.user.role !== "both") return;

  const config = mpOAuthConfig();
  const state = randomState();
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_MS / 1000,
  });

  redirect(buildMpAuthorizationUrl(config, state));
}

export async function disconnectMercadoPagoAction(): Promise<void> {
  const session = await getSession();
  if (!session) return;
  if (session.user.role !== "seller" && session.user.role !== "both") return;

  await drizzleMpSellerAccountRepository.remove(session.user.id);
  revalidatePath("/dashboard/settings");
}
