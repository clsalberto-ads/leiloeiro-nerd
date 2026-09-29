"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "./auth-actions";
import { becomeSellerSchema, formToObject } from "@/lib/validators";
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
  // `update-profile` ja implementa (vazio = nao mexer neste campo).
  name: z.string().trim().optional().transform((v) => v || undefined).pipe(z.string().min(2, "Nome muito curto").optional()),
  phone: z.string().trim().optional().transform((v) => v || undefined),
  slug: z.string().trim().optional().transform((v) => v || undefined),
  address: z.string().trim().optional().transform((v) => v || undefined),
});

export async function updateProfileAction(_prev: ProfileActionResult | null, formData: FormData): Promise<ProfileActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const parsed = profileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    await updateProfile(drizzleUserRepository, session.user.id, parsed.data);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes("23505") || raw.includes("duplicate")) {
      return { error: "Este slug já está em uso" };
    }
    return { error: "Não foi possível salvar o perfil. Tente novamente." };
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
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes("23505") || raw.includes("duplicate")) {
      return { error: "Este slug já está em uso" };
    }
    // ponytail: mensagem generica, e nao `raw` — o mesmo tratamento que o
    // `updateProfileAction` acima dá a este exato branch. `err.message` de uma
    // falha de driver é `connect ECONNREFUSED 127.0.0.1:5432` ou
    // `permission denied for schema user`: o usuario nao pode corrigir nenhuma
    // das duas, e a segunda ainda entrega a topologia do banco.
    return { error: "Não foi possível ativar a conta de leiloeiro. Tente novamente." };
  }
  revalidatePath("/dashboard/settings");
  return { ok: true };
}