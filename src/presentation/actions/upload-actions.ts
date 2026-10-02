"use server";

import { getSession } from "./auth-actions";
import { deleteItemImage } from "@/application/use-cases/delete-item-image";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { utapi } from "@/infrastructure/upload/uploadthing";
import { imageUploadSchema } from "@/lib/validators";
import { toActionError } from "@/lib/action-error";

export type UploadActionResult = { urls?: string[]; error?: string; partial?: boolean; falhas?: number };

export async function uploadItemImagesAction(
  _prev: UploadActionResult | null,
  formData: FormData,
): Promise<UploadActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  // ponytail: o gate de papel. A action checava SO a sessao, mas a imagem aqui
  // so existe para um item — e `createItem` ja exige `seller`/`both`. Um
  // comprador registrado (que e o caso mais comum, e a conta mais facil de
  // criar) podia chamar a action quantas vezes quisesse, 10 x 8MB por chamada,
  // sem nunca anexar o resultado a nada: so queimando a cota paga de
  // armazenamento do projeto. A sessao sozinha nao e um suficiente aqui.
  if (session.user.role !== "seller" && session.user.role !== "both") {
    return { error: "Apenas leiloeiros podem enviar imagens" };
  }
  const parsed = imageUploadSchema.safeParse({ images: formData.getAll("images") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Imagens inválidas" };
  try {
    const results = await utapi.uploadFiles(Array.from(parsed.data.images));
    const urls = results.filter((r) => r.error === null).map((r) => r.data!.ufsUrl);
    const falhas = results.filter((r) => r.error !== null).length;
    if (urls.length === 0) return { error: "Não foi possível enviar as imagens." };
    // ponytail: falha parcial NÃO volta como erro (o usuario ainda pode salvar o que
    // subiu), mas volta como `partial: true` para a UI avisar: "X de Y imagens
    // falharam". Sem isso, o usuario via 3 previews, achava que as 4 tinham
    // subido, e salvava o item achando que estava completo.
    if (falhas > 0) return { urls, partial: true, falhas };
    return { urls };
  } catch (err) {
    return { error: toActionError(err, "Não foi possível enviar as imagens.") };
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
    return { error: toActionError(err, "Não foi possível excluir a imagem.") };
  }
}