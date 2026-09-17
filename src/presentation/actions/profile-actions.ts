"use server";

import { z } from "zod";
import { getSession } from "./auth-actions";
import { becomeSellerSchema, formToObject } from "@/lib/validators";
import { becomeSeller } from "@/application/use-cases/become-seller";
import { updateProfile } from "@/application/use-cases/update-profile";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";

export type ProfileActionResult = { ok?: boolean; error?: string };

const profileSchema = z.object({
  name: z.string().min(2, "Nome muito curto").optional(),
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
    return { error: raw || "Não foi possível ativar a conta de leiloeiro." };
  }
  return { ok: true };
}