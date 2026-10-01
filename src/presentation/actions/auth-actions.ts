"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/infrastructure/auth/better-auth";
import { forgotPasswordSchema, formToObject, signInSchema, signUpSchema } from "@/lib/validators";

export type ActionResult = { ok?: boolean; error?: string };

export async function getSession() {
  const h = await headers();
  return auth.api.getSession({ headers: h });
}

export async function signUpAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    await auth.api.signUpEmail({ body: parsed.data });
  } catch {
    return { error: "Não foi possível criar a conta. Verifique se o e-mail já está cadastrado." };
  }
  // ponytail: o `redirect` vem DEPOIS do guarda de erro, nunca antes — um
  // e-mail duplicado arrancaria o visitante do formulario e o jogaria no painel
  // sem sessao, que e pior que ficar parado. Mesmo desenho de `item-actions`.
  redirect("/dashboard");
}

export async function signInAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    await auth.api.signInEmail({ body: parsed.data });
  } catch {
    return { error: "Credenciais inválidas" };
  }
  // ponytail: nao ha `return { ok: true }` depois daqui. O `redirect` LANCA
  // (NEXT_REDIRECT) e nunca devolve, entao um `return` ali seria codigo morto que
  // o `tsc` nao acusa — e da a ler como se o fluxo ainda parasse na pagina.
  // O cookie de sessao ja foi gravado pelo `nextCookies()` quando `signInEmail`
  // resolve, por isso o redirect leva o usuario autenticado.
  redirect("/dashboard");
}

export async function forgotPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    await auth.api.requestPasswordReset({ body: { email: parsed.data.email } });
  } catch {
    return { error: "Não foi possível enviar as instruções. Tente novamente." };
  }
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const h = await headers();
  await auth.api.signOut({ headers: h });
  redirect("/login");
}