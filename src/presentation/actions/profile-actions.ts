"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "./auth-actions";
import { becomeSellerSchema, formToObject } from "@/lib/validators";
import { toActionError } from "@/lib/action-error";
import { becomeSeller } from "@/application/use-cases/become-seller";
import { updateProfile } from "@/application/use-cases/update-profile";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";

export type ProfileActionResult = { ok?: boolean; error?: string };

const profileSchema = z.object({
  // ponytail: o mesmo `v || undefined` dos campos abaixo, e pelo mesmo motivo: um
  // `<input>` intocado chega no FormData como `""`, nao como ausente. Sem esta
  // traducao, `min(2)` reprovava o `""` e o `updateProfile` nunca era alcancado
  // — o usuario que abriu /dashboard/settings para trocar o celular recebia
  // "Nome muito curto" e nada era salvo, a menos que reescrevesse o nome.
  // Traduzir "vazio" para "nao enviado" tambem casa com a convencao que o
  // `update-profile` ja implementa (empty = nao mexer neste campo).
  name: z.string().trim().optional().transform((v) => v || undefined).pipe(z.string().min(2, "Nome muito curto").optional()),
  phone: z.string().trim().optional().transform((v) => v || undefined),
  slug: z.string().trim().optional().transform((v) => v || undefined),
  address: z.string().trim().optional().transform((v) => v || undefined),
});

// ponytail: o `pg` e lido de `err.code`, e nao com `includes()`
// varrendo a mensagem. O `pg` poe o codigo nos dois lugares hoje, mas o
// `err.code` na mensagem e um palpite sobre o formato de texto de um driver: se
// o `pg` mudar a frase, o `.includes(\"duplicate\")` ainda pode salvar, e se ele
// calar a frase o tratamento do conflito SOME sem nenhum teste ficar vermelho —
// porque o teste fixa a mensagem que o `pg` escreve hoje.
//
// E o resto deixa de ser engolido. "Slug excede 60 caracteres" e "Slug contains
// caracteres invalidos" sao erros de dominio que o usuario corrige digitando
// outra coisa, e o catch antigo transformava os dois (e qualquer `Error` sem
// `code`) no mesmo "nao foi possivel salvar o perfil", que nao diz nada. O
// `toActionError` ja faz a separacao certa sozinho: driver sempre anexa `code`,
// nosso codigo nunca anexa.
function profileError(err: unknown, fallback: string): string {
  if (err instanceof Error && "code" in err && err.code === "23505") return "Este slug já está em uso";
  return toActionError(err, fallback);
}

export async function updateProfileAction(_prev: ProfileActionResult | null, formData: FormData): Promise<ProfileActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const parsed = profileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    await updateProfile(drizzleUserRepository, session.user.id, parsed.data);
  } catch (err) {
    return { error: profileError(err, "Não foi possível salvar o perfil. Tente novamente.") };
  }
  // ponytail: a pagina de configuracoes e um SERVER component que le
  // `session.user.role` para decidir se renderiza o `BecomeSellerForm`
  // (settings/page.tsx). Sem revalidar, apos "Conta de leiloeiro ativada." o
  // formulario continuava na tela — e clicar de novo reexecutava o
  // `becomeSeller`, reescrevendo o slug publico em silencio. Nenhuma action
  // deste arquivo revalidava nada: nao havia um unico `revalidatePath` no
  // projeto.
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export type SellerActionResult = { ok?: boolean; error?: string };

export async function becomeSellerAction(_prev: SellerActionResult | null, formData: FormData): Promise<SellerActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const parsed = becomeSellerSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    await becomeSeller(drizzleUserRepository, session.user.id, parsed.data as { slug: string; role: "seller" | "both" });
  } catch (err) {
    return { error: profileError(err, "Não foi possível ativar a conta de leiloeiro. Tente novamente.") };
  }
  revalidatePath("/dashboard/settings");
  return { ok: true };
}