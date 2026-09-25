"use client";
import { useActionState, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { placeBidAction } from "@/presentation/actions/bid-actions";
import { formatReais } from "@/lib/format-reais";
import { placeBidSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";

interface BidFormProps {
  itemId: string;
  minBid: number;
}

// ponytail: o `amount` do placeBidSchema (do servidor) e o payload em CENTAVOS
// (`.int()` + piso de 100) — quem converte reais -> centavos e este componente,
// nao o zod. O campo visivel e em reais e o piso dele e o `minBid` do item, o
// mesmo que o atributo `min` ja impunha; por isso o schema do form pega so o
// `itemId` do servidor e declara o `amount` em reais. `zodResolver(placeBidSchema)`
// direto no campo visivel acusaria "Lance mínimo R$ 1,00" em qualquer lance
// valido abaixo de R$ 100.
function bidFormSchema(minBid: number) {
  return placeBidSchema.pick({ itemId: true }).extend({
    amountReais: z
      .number({ message: "Lance inválido" })
      .positive("Lance inválido")
      .min(minBid / 100, `Lance mínimo R$ ${formatReais(minBid)}`),
  });
}

// Sem coerce/transform/default no schema do form: o input usa `valueAsNumber`,
// logo `z.input` e `z.output` coincidem e o useForm de uma generic basta.
type BidFormValues = z.input<ReturnType<typeof bidFormSchema>>;

export function BidForm({ itemId, minBid }: BidFormProps) {
  const [state, formAction, pending] = useActionState(placeBidAction, null);
  const minReais = formatReais(minBid);
  const schema = useMemo(() => bidFormSchema(minBid), [minBid]);
  const form = useForm<BidFormValues>({
    resolver: zodResolver(schema),
    // ponytail: "onTouched" e nao "onBlur" — rationale em item-form.tsx; sem
    // handleSubmit o erro de um "onBlur" ficaria stale ate o proximo blur.
    mode: "onTouched",
    defaultValues: { itemId },
  });
  const { errors } = form.formState;
  // ponytail: o `amount` do FormData e o hidden em centavos derivado do campo
  // visivel; enquanto o campo esta vazio ele carrega o minimo em centavos (o
  // `useState(minBid)` de antes) — o `required` e o que bloqueia o envio.
  // `useWatch` e nao `form.watch()` porque o lint de react-hooks marca o
  // `watch` como incompativel com o React Compiler.
  const amountReais = useWatch({ control: form.control, name: "amountReais" });
  const centavos = Number.isFinite(amountReais) ? Math.round(amountReais * 100) : minBid;

  return (
    // ponytail: sem gate no submit — a placeBidAction segue validando com o placeBidSchema; trocar por handleSubmit só se o form sair do server action.
    <form action={formAction} className="space-y-3">
      {state && "error" in state && state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      {state && state.ok ? <p className="text-sm text-emerald-600">Lance registrado!</p> : null}
      <div className="space-y-2">
        <Field id="amount" label="Seu lance (R$)" error={errors.amountReais?.message}>
          {(p) => (
            // ponytail: o campo do RHF se chama `amountReais` (e nao `amount`)
            // porque o `onChange` do RHF le o `name` do proprio input do DOM: o
            // `name="amount"` do payload e o hidden em centavos logo abaixo e os
            // dois nao podem colidir. O `amountReais` extra no FormData e
            // descartado pelo placeBidSchema da action.
            <Input
              {...p}
              {...form.register("amountReais", { valueAsNumber: true })}
              type="number"
              step="0.01"
              min={minBid / 100}
              placeholder={`Mínimo R$ ${minReais}`}
              required
              disabled={pending}
            />
          )}
        </Field>
        <input type="hidden" name="amount" value={centavos} />
        <input type="hidden" value={itemId} {...form.register("itemId")} />
      </div>
      <Button type="submit" disabled={pending}>Dar lance</Button>
    </form>
  );
}
