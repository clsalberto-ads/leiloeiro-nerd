"use client";
import { useActionState, useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { placeBidAction } from "@/presentation/actions/bid-actions";
import { formatBRL } from "@/lib/format-brl";
import { bidFormSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { BidView } from "@/domain/repositories/bid-repository";

interface BidFormProps {
  itemId: string;
  minBid: number;
  /**
   * Avisa quem segura o historico que um lance acabou de entrar. O
   * `BidSection` mantem os lances em `useState` e so os atualiza pelo poll de
   * 10s, entao sem isto o usuario recebia o toast "Lance registrado!" e via a
   * propria lista sem o lance dele por ate 10 segundos, com o `min` do input
   * ainda no valor anterior — e um segundo lance imediato era recusado no
   * cliente. `revalidatePath` na action nao resolve: a page ja esta montada e o
   * `useState` do cliente nao se ressincroniza de props novas.
   */
  onBid?: (bid: BidView) => void;
}

// Sem coerce/transform/default no schema do form: o input usa `valueAsNumber`,
// logo `z.input` e `z.output` coincidem e o useForm de uma generic basta.
type BidFormValues = z.input<ReturnType<typeof bidFormSchema>>;

export function BidForm({ itemId, minBid, onBid }: BidFormProps) {
  const [state, formAction, pending] = useActionState(placeBidAction, null);
  const minReais = formatBRL(minBid);
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
  const handleSubmit = form.handleSubmit;
  // ponytail: o `amount` do FormData e o hidden em centavos derivado do campo
  // visivel; enquanto o campo esta vazio ele carrega o minimo em centavos (o
  // `useState(minBid)` de antes) — o `required` e o que bloqueia o envio.
  // `useWatch` e nao `form.watch()` porque o lint de react-hooks marca o
  // `watch` como incompativel com o React Compiler.
  const amountReaisStr = useWatch({ control: form.control, name: "amountReais" });
  const amountReais = Number(amountReaisStr);
  const centavos = Number.isFinite(amountReais) ? Math.round(amountReais * 100) : minBid;

  // ponytail: o toast e o `onBid` sao disparados UMA VEZ por resultado de action,
  // e nao uma vez por execucao do efeito. `onBid` entra no array de deps e o pai
  // NAO memoiza essa funcao: cada poll de 10s que traz lances novos re-renderiza o
  // `BidSection`, o `placeBid` ganha uma identidade nova, o efeito roda de novo
  // com o `state` do lance que JA TINHA SIDO TRATADO, e o usuario via
  // "Lance registrado!" de novo — quantas vezes o polling rodasse antes de ele
  // mudar de aba. O `ref` amarra o efeito a IDENTIDADE do `state`, que e o que
  // representa um resultado novo da action; os outros deps viram so gatilho de
  // re-execucao, e o `ref` e quem impede o disparo repetido.
  const stateTratado = useRef<typeof state>(null);
  useEffect(() => {
    if (!state) return;
    if (stateTratado.current === state) return;
    stateTratado.current = state;
    if (state.ok) {
      toast.success("Lance registrado!");
      if (state.bid) onBid?.(state.bid);
      form.reset({ itemId, amountReais: minBid / 100 });
    } else if (state.error) {
      toast.error(state.error);
    }
    // ponytail: accessibility constraint (DOM alert must stay) - the toast is visual-only, in-DOM alert for screen readers
    // ponytail: `onBid` entra no array porque e o que empurra o lance novo para
    // o historico do `BidSection`; sem ele aqui, um `onBid` trocado pelo pai nao
    // re-dispararia o efeito. `form` e `itemId` ja eram exigidos pelo
    // `form.reset`, e `minBid` pelo `amountReais` do reset.
  }, [state, minBid, onBid, form, itemId]);

  const onSubmit = async (data: BidFormValues) => {
    const formData = new FormData();
    formData.set("itemId", data.itemId);
    formData.set("amount", Math.round(Number(data.amountReais) * 100).toString());
    await formAction(formData);
  };

  return (
    // ponytail: sem gate no submit — a placeBidAction segue validando com o placeBidSchema; trocar por handleSubmit só se o form sair do server action.
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
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