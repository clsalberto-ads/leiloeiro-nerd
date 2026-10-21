import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzlePagBankSellerAccountRepository } from "@/infrastructure/database/repositories/drizzle-pagbank-seller-account-repository";
import { buildConnectAuthorizationUrl } from "@/infrastructure/pagbank/connect";

const STATE_COOKIE = "pagbank_oauth_state";
const STATE_TTL_MS = 10 * 60 * 1000;

function randomState(): string {
  return crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
}

export async function connectPagBankAction(): Promise<void> {
  const session = await getSession();
  if (!session) return;
  if (session.user.role !== "seller" && session.user.role !== "both") return;

  const state = randomState();
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_MS / 1000,
  });

  redirect(buildConnectAuthorizationUrl(state));
}

export async function disconnectPagBankAction(): Promise<void> {
  const session = await getSession();
  if (!session) return;
  if (session.user.role !== "seller" && session.user.role !== "both") return;
  await drizzlePagBankSellerAccountRepository.remove(session.user.id);
  revalidatePath("/dashboard/settings");
}
