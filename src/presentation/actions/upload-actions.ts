"use server";

import { getSession } from "./auth-actions";
import { deleteItemImage } from "@/application/use-cases/delete-item-image";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { utapi } from "@/infrastructure/upload/uploadthing";
import { imageUploadSchema } from "@/lib/validators";

export type UploadActionResult = { urls?: string[]; error?: string };

export async function uploadItemImagesAction(
  _prev: UploadActionResult | null,
  formData: FormData,
): Promise<UploadActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const parsed = imageUploadSchema.safeParse({ images: formData.getAll("images") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Imagens inválidas" };
  try {
    const results = await utapi.uploadFiles(Array.from(parsed.data.images));
    const urls = results.filter((r) => r.error === null).map((r) => r.data!.ufsUrl);
    if (urls.length === 0) return { error: "Não foi possível enviar as imagens." };
    return { urls };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível enviar as imagens." };
  }
}

export async function deleteItemImageAction(
  _prev: { ok?: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const imageId = String(formData.get("imageId") ?? "");
  try {
    await deleteItemImage(drizzleItemRepository, session.user.id, imageId);
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível excluir a imagem." };
  }
}