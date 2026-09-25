import { z } from "zod";
import { createSlug } from "@/domain/value-objects/slug";
import { formatReais } from "@/lib/format-reais";

// ponytail: UNIDADE. O dominio, o payload da action e o `minBid` do item sao
// sempre em CENTAVOS; so o campo visivel do form de lance e em REAIS. Este
// divisor e a unica ponte entre as duas — o `reaisToCents` vai p/ cima dele e o
// `bidFormSchema` divide por ele, em vez de reescrever o piso como literal.
const CENTAVOS_POR_REAL = 100;

const reaisToCents = (v: number) => Math.round(v * CENTAVOS_POR_REAL);

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

// ponytail: o piso canonico do lance, em CENTAVOS, mora aqui e e lido pelo
// `placeBidSchema` e pelo `bidFormSchema` (que so divide por CENTAVOS_POR_REAL).
// Nenhum dos dois pode reescrever o numero; a tabela de paridade em
// validators.test.ts e o que quebra se os dois divergirem.
export const MIN_BID_CENTAVOS = 100;

const LANCE_INVALIDO = "Lance inválido";

export const placeBidSchema = z.object({
  itemId: z.string().uuid(),
  amount: z.coerce.number().positive(LANCE_INVALIDO).int(LANCE_INVALIDO).refine((v) => v >= MIN_BID_CENTAVOS, `Lance mínimo R$ ${formatReais(MIN_BID_CENTAVOS)}`),
});

/**
 * Schema do campo visivel do form de lance: `itemId` vem do servidor (pick) e
 * `amountReais` e o que o usuario digita, em REAIS. O piso e o `minBid` do item
 * (em centavos) convertido pelo mesmo divisor do servidor, e nunca abaixo do
 * `MIN_BID_CENTAVOS` — assim um item com `minInitialBid` de R$ 1,00 nao pode
 * deixar passar um lance que a action vai rejeitar.
 */
export function bidFormSchema(minBid: number) {
  const pisoCentavos = Math.max(minBid, MIN_BID_CENTAVOS);
  return placeBidSchema.pick({ itemId: true }).extend({
    amountReais: z
      .number({ message: LANCE_INVALIDO })
      .positive(LANCE_INVALIDO)
      // o `amount` do payload e em centavos: o lance em reais precisa sobreviver
      // a ida e volta (reais -> centavos -> reais). E o mesmo "centavos
      // inteiros" que o `placeBidSchema` exige, sem depender do `step` do input.
      .refine((v) => reaisToCents(v) / CENTAVOS_POR_REAL === v, LANCE_INVALIDO)
      .min(pisoCentavos / CENTAVOS_POR_REAL, `Lance mínimo R$ ${formatReais(pisoCentavos)}`),
  });
}

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