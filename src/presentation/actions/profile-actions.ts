"use server";

import { z } from "zod";
import { getSession } from "./auth-actions";
import { formToObject } from "@/lib/validators";
import { updateProfile } from "@/application/use-cases/update-profile";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";

export type ProfileActionResult = { ok?: boolean; error?: string };

const profileSchema = z.object({
  name: z.string().min(2, "Nome muito curto").optional(),
  phone: z.string().optional(),
  slug: z.string().optional(),
  address: z.string().optional(),
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
  return { ok: true };
}