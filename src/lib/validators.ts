import { z } from "zod";
import { createSlug } from "@/domain/value-objects/slug";

const reaisToCents = (v: number) => Math.round(v * 100);

export const signUpSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
});

export const signInSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

/** Converte FormData num objeto plano para validação Zod em server actions. */
export function formToObject(formData: FormData): Record<string, string> {
  return Object.fromEntries(formData.entries()) as Record<string, string>;
}

export const itemSchema = z.object({
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres").max(150, "Título muito longo"),
  description: z.string().min(10, "Descrição deve ter no mínimo 10 caracteres").max(5000, "Descrição muito longa"),
  type: z.enum(["product", "service", "piece"], { message: "Tipo inválido" }),
  minInitialBid: z.coerce.number().positive("Lance mínimo inválido").refine((v) => v >= 1, "Lance mínimo deve ser de pelo menos R$ 1,00").transform(reaisToCents),
  minBidIncrement: z.coerce.number().positive("Incremento mínimo inválido").refine((v) => v >= 1, "Incremento mínimo deve ser de pelo menos R$ 1,00").transform(reaisToCents),
  bidDeadline: z.coerce.date({ message: "Prazo de lances inválido" }).refine((d) => d.getTime() > Date.now(), "Prazo de lances deve ser no futuro"),
  paymentDeadlineDays: z.coerce.number().int("Dias de pagamento inválido").min(1, "Mínimo 1 dia para pagamento").max(30, "Máximo 30 dias para pagamento").default(3),
  imageUrls: z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (!s) return undefined;
      try {
        const parsed = JSON.parse(s);
        if (!Array.isArray(parsed)) {
          ctx.addIssue({ code: "custom", message: "field inválido" });
          return z.INVALID;
        }
        return parsed;
      } catch {
        return undefined;
      }
    })
    .pipe(z.array(z.string().url()).max(10).optional()),
});

export const imageUploadSchema = z.object({
  images: z
    .custom<FileList>(
      (v): v is FileList =>
        v != null && typeof v !== "string" && typeof (v as { length?: unknown }).length === "number",
      "Lista de imagens inválida",
    )
    .refine((f) => f.length <= 10, "Máximo 10 imagens")
    .refine((f) => Array.from(f).every((file) => file.size <= 8 * 1024 * 1024), "Máximo 8MB por imagem")
    .refine((f) => Array.from(f).every((file) => file.type.startsWith("image/")), "Apenas imagens"),
});

export const placeBidSchema = z.object({
  itemId: z.string().uuid(),
  amount: z.coerce.number().positive("Lance inválido").refine((v) => v >= 100, "Lance mínimo R$ 1,00"),
});

export const becomeSellerSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug obrigatório")
    .transform((v, ctx) => {
      try {
        return createSlug(v);
      } catch (e) {
        ctx.addIssue(e instanceof Error ? e.message : "Slug inválido");
        return z.INVALID;
      }
    }),
  role: z.enum(["seller", "both"], { message: "Papel inválido" }),
});