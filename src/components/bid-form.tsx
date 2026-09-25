"use client";
import { useActionState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { placeBidAction } from "@/presentation/actions/bid-actions";
import { formatReais } from "@/lib/format-reais";
import { bidFormSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";

interface BidFormProps {
  itemId: string;
  minBid: number;
}

// Sem coerce/transform/default no schema do form: o input usa `valueAsNumber`,
// logo `z.input` e `z.output` coincidem e o useForm de uma generic basta.
type BidFormValues = z.input<ReturnType<typeof bidFormSchema>>;

export function BidForm({ itemId, minBid }: BidFormProps) {
  const [state, formAction, pending] = useActionState(placeBidAction, null);
  const minReais = formatReais(minBid);
  const form = useForm<BidFormValues>({
    // ponytail: sem `useMemo` no schema/resolver, como nos outros forms
    // (item-form.tsx:49 e os de auth) — o memo anterior envolvia o schema mas
    // nao o `zodResolver`, que era reconstruido a cada render mesmo assim, e o
    // RHF le `resolver` de `control._options`, que ele refresca a cada render.
    resolver: zodResolver(bidFormSchema(minBid)),
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
            // inofensivo por construcao: o `z.object` do placeBidSchema
            // descarta chave desconhecida (strip) e a action so le `itemId` e
            // `amount` — e nao por acaso.
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
