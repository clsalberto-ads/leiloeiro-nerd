import { z } from "zod";
import { createSlug } from "@/domain/value-objects/slug";
import { formatBRL } from "@/lib/format-brl";
import { fromInputDateString } from "@/lib/timezone";

// ponytail: FONTE ÚNICA DE VERDADE. Domínio, payload da action e o `minBid` do
// item são SEMPRE em CENTAVOS; só o campo visível do formulário de lance é em
// REAIS. Este divisor é a única ponte entre os dois — `reaisToCents` sobe até ele
// e `bidFormSchema` divide por ele, em vez de reescrever o piso como literal.
const CENTS_PER_REAL = 100;

const reaisToCents = (v: number) => Math.round(v * CENTS_PER_REAL);

// ponytail: TETO DE DINHEIRO, em CENTAVOS. Toda coluna de dinheiro é `integer`
// (int4) no Postgres, e int4 estoura em 2_147_483_647. Sem este teto,
// `amount: 5000000000` passa no `placeBidSchema` (que só tem piso), passa na
// revalidação dentro da transação e morre no `INSERT` com
// `22003 integer out of range` — que a action devolvia ao usuário como
// `err.message`, isto é, o SQL do insert e os parâmetros na tela. O teto fecha a
// porta na fronteira, que é onde ela deve ficar.
// 2_000_000_000 centavos = R$ 20.000.000,00: muito acima de qualquer leilão, com
// folga para o teto do int4.
export const MAX_CENTS = 2_000_000_000;
const MONEY_LIMIT_MSG = "Valor acima do máximo permitido";
// Teto do `integer` do Postgres. O `MAX_CENTS` acima e o teto de NEGOCIO (e fica
// abaixo deste de proposito, para o int4 ser o limite final); a soma dos dois campos
// de dinheiro e medida contra este, porque e a soma que o `placeBid` faz.
const INT4_MAX = 2_147_483_647;

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

/** Converte `FormData` em um objeto plano para a validação do Zod nas server actions. */
export function formToObject(formData: FormData): Record<string, string> {
  return Object.fromEntries(formData.entries()) as Record<string, string>;
}

export const itemSchema = z.object({
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres").max(150, "Título muito longo"),
  description: z.string().min(10, "Descrição deve ter no mínimo 10 caracteres").max(5000, "Descrição muito longa"),
  type: z.enum(["product", "service", "piece"], { message: "Tipo inválido" }),
  minInitialBid: z.coerce.number().positive("Lance mínimo inválido").max(MAX_CENTS / CENTS_PER_REAL, MONEY_LIMIT_MSG).refine((v) => v >= 1, "Lance mínimo deve ser de pelo menos R$ 1,00").transform(reaisToCents),
  minBidIncrement: z.coerce.number().positive("Incremento mínimo inválido").max(MAX_CENTS / CENTS_PER_REAL, MONEY_LIMIT_MSG).refine((v) => v >= 1, "Incremento mínimo deve ser de pelo menos R$ 1,00").transform(reaisToCents),
  // ponytail: o preprocess NÃO substitui o `z.coerce.date()`, ele apenas
  // repassa a string para `fromInputDateString` antes disso. Um `Date` pronto
  // continua passando direto (é a checagem `typeof === "string"`), e uma ISO com
  // `Z`/`+hh:mm` também passa: são inequívocas, e o `fromInputDateString` as
  // repassa. SÓ a string crua de `datetime-local` — a única sem zona — é lida no
  // fuso do produto. Sem isso, salvar QUALQUER campo do item em um servidor UTC
  // arrastava o prazo 3 h para trás. Veja `fromInputDateString` em `@/lib/timezone`.
  bidDeadline: z.preprocess(
    (v) => (typeof v === "string" ? fromInputDateString(v) : v),
    z.coerce.date({ message: "Prazo de lances inválido" }).refine((d) => d.getTime() > Date.now(), "Prazo de lances deve ser no futuro"),
  ),
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
    .pipe(z.array(z.url({ protocol: /^https?$/ })).max(10).optional()),
})
  // ponytail: o teto acima fecha cada campo, mas o `placeBid` soma
  // `highestBid.amount + minBidIncrement` para chegar no piso do proximo lance.
  // Dois campos cada um no teto dao uma soma de 4_000_000_000, que passa em cada
  // `.max`, passa no `invalidMoney` do piso e NAO tem nenhum valor valido de
  // lance: o item aceitava o primeiro lance e ficava para sempre sem segundo,
  // sem erro visivel. O limite da SOMA e o do `int4` (2_147_483_647) e nao o
  // `MAX_CENTS` de negocio (2_000_000_000) — `MAX_CENTS` como teto da soma
  // rejeitaria `minInitialBid` exatamente no teto, que `validators.test.ts`
  // fixa como valor VALIDO, e o incremento tem `.min(1)`: nunca da para zero.
  .refine((v) => v.minInitialBid + v.minBidIncrement <= INT4_MAX, {
    message: "Lance mínimo + incremento não pode passar do máximo permitido",
    path: ["minBidIncrement"],
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

// ponytail: o piso canônico de lance, em CENTAVOS, mora aqui e é lido tanto por
// `placeBidSchema` quanto por `bidFormSchema` (que só divide por `CENTS_PER_REAL`).
// Nenhum dos dois pode reescrever o número; a tabela de paridade em
// validators.test.ts é o que quebra se os dois divergirem.
export const MIN_BID_CENTS = 100;

const INVALID_BID = "Lance inválido";

export const placeBidSchema = z.object({
  itemId: z.string().uuid(),
  amount: z.coerce.number().positive(INVALID_BID).int(INVALID_BID).max(MAX_CENTS, MONEY_LIMIT_MSG).refine((v) => v >= MIN_BID_CENTS, `Lance mínimo R$ ${formatBRL(MIN_BID_CENTS)}`),
});

/**
 * Schema do campo visível do formulário de lance: `itemId` vem do servidor (via
 * `pick`) e `amountReais` é o que o usuário digita, em REAIS. O piso é o `minBid`
 * do item (em centavos) convertido pelo mesmo divisor do servidor, e nunca abaixo
 * de `MIN_BID_CENTS` — assim um item com `minInitialBid` de R$ 1,00 não deixa
 * passar um lance que a action vai rejeitar.
 */
export function bidFormSchema(minBid: number) {
  const floorCents = Math.max(minBid, MIN_BID_CENTS);
  return placeBidSchema.pick({ itemId: true }).extend({
    amountReais: z
      .number({ message: INVALID_BID })
      .positive(INVALID_BID)
      // o `amount` do payload é em centavos: o lance em reais precisa sobreviver
      // ao ida-e-volta (reais -> centavos -> reais). Mesmos "centavos inteiros" que
      // o `placeBidSchema` exige, sem depender do `step` do input.
      .refine((v) => reaisToCents(v) / CENTS_PER_REAL === v, INVALID_BID)
      .max(MAX_CENTS / CENTS_PER_REAL, MONEY_LIMIT_MSG)
      .min(floorCents / CENTS_PER_REAL, `Lance mínimo R$ ${formatBRL(floorCents)}`),
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