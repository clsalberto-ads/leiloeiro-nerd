"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createItemAction, updateItemAction } from "@/presentation/actions/item-actions";
import { uploadItemImagesAction } from "@/presentation/actions/upload-actions";
import { itemSchema } from "@/lib/validators";
import type { Item } from "@/domain/repositories/item-repository";

type ItemInput = z.input<typeof itemSchema>;
type ItemOutput = z.output<typeof itemSchema>;

export function ItemForm({ item, mode }: { item?: Item | null; mode: "create" | "edit" }) {
  const router = useRouter();
  const action = mode === "create" ? createItemAction : updateItemAction;
  const [state, formAction, pending] = useActionState(action, null as { error?: string; ok?: boolean } | null);
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadItemImagesAction,
    null as { urls?: string[]; error?: string } | null,
  );
  const [urls, setUrls] = useState<string[]>([]);
  const [absorbedUpload, setAbsorbedUpload] = useState<string[]>([]);
  const locked = mode === "edit" && item?.status !== "draft";

  useEffect(() => {
    if (state && state.ok) router.push("/dashboard/items");
  }, [state, router]);

  const uploaded = uploadState?.urls;
  if (uploaded?.length && uploaded !== absorbedUpload) {
    setAbsorbedUpload(uploaded);
    setUrls((prev) => [...prev, ...uploaded]);
  }

  const removeUrl = (url: string) => setUrls((prev) => prev.filter((u) => u !== url));

  const formattedDate = item?.bidDeadline
    ? new Date(item.bidDeadline.getTime() - item.bidDeadline.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : undefined;

  const form = useForm<ItemInput, unknown, ItemOutput>({
    resolver: zodResolver(itemSchema),
    // ponytail: "onTouched" e nao "onBlur" porque reValidateMode so vale com isSubmitted (nunca true sem handleSubmit); revalidar a cada tecla e a unica forma de limpar o erro sem novo blur.
    mode: "onTouched",
    defaultValues: {
      title: item?.title ?? "",
      description: item?.description ?? "",
      type: item?.type ?? "product",
      paymentDeadlineDays: item?.paymentDeadlineDays ?? 3,
      minInitialBid: item ? item.minInitialBid / 100 : undefined,
      minBidIncrement: item ? item.minBidIncrement / 100 : undefined,
      bidDeadline: formattedDate,
    },
  });
  const { errors } = form.formState;

  return (
    <div className="max-w-xl space-y-4">
      {!locked ? (
        <form action={uploadAction} className="space-y-2">
          <Label htmlFor="images">Imagens</Label>
          <div className="flex items-center gap-2">
            <Input id="images" name="images" type="file" accept="image/*" multiple disabled={uploadPending} />
            <Button type="submit" disabled={uploadPending}>{uploadPending ? "Enviando…" : "Enviar"}</Button>
          </div>
          {uploadState?.error ? <p role="alert" className="text-sm text-destructive">{uploadState.error}</p> : null}
        </form>
      ) : null}
      {/* ponytail: sem gate no submit — a action segue valitando com o itemSchema; trocar por handleSubmit só se o form sair do server action. */}
      <form action={formAction} className="space-y-4">
        {state && "error" in state && state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
        {locked ? <p className="text-sm text-amber-600">Item publicado — edição bloqueada.</p> : null}
        {/* ponytail: imageUrls fica fora do RHF (input hidden controlado por React); a validação continua no servidor. */}
        <input type="hidden" name="imageUrls" value={JSON.stringify(urls)} />
        {urls.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {urls.map((url) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-16 w-16 rounded-md object-cover" />
                <button
                  type="button"
                  onClick={() => removeUrl(url)}
                  disabled={locked}
                  aria-label="Remover imagem"
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {mode === "edit" && item ? <input type="hidden" name="id" value={item.id} /> : null}
      <div className="group grid grid-cols-1 gap-4 sm:grid-cols-2" data-disabled={locked || undefined}>
        <div className="sm:col-span-2">
          <Field id="title" label="Título" error={errors.title?.message}>
            {(p) => (
              <Input
                {...p}
                {...form.register("title")}
                defaultValue={item?.title ?? ""}
                required
                maxLength={150}
                disabled={locked}
              />
            )}
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id="description" label="Descrição" error={errors.description?.message}>
            {(p) => (
              <textarea
                {...p}
                {...form.register("description")}
                defaultValue={item?.description ?? ""}
                required
                minLength={10}
                maxLength={5000}
                rows={4}
                disabled={locked}
                className="rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
              />
            )}
          </Field>
        </div>
        <Field id="type" label="Tipo" error={errors.type?.message}>
          {(p) => (
            <select
              {...p}
              {...form.register("type")}
              defaultValue={item?.type ?? "product"}
              required
              disabled={locked}
              className="rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50 aria-invalid:border-destructive"
            >
              <option value="product">Produto</option>
              <option value="service">Serviço</option>
              <option value="piece">Peça colecionável</option>
              {/* ponytail: as tres `<option>` sao o ultimo lugar onde o rotulo de
               tipo aparece depois que `ROTULO_TIPO` virou o vocabulario canonico
               (o badge, a coluna da tabela, a aba e a busca server-side leem o
               mapa; aqui o texto ainda esta escrito a mao). A divergencia e o mesmo
               defeito silencioso dos outros: o `<option>` diz "Serviço" e a tabela
               diz outra coisa.
               A correcao e
               `Object.entries(ROTULO_TIPO).map(([value, rotulo]) => <option …>)`, e
               ela nao tem NENHUMA decisao de produto pendente: a ordem do mapa
               (`product`, `service`, `piece`) ja e a ordem das opcoes, e a chave do
               mapa ja e o `value` gravado. O que falta e escopo, nao decisao — este
               formulario nao entrou na tarefa da tabela, e mexer no preenchimento dele
               e um diff proprio. */}
            </select>
          )}
        </Field>
        <Field id="paymentDeadlineDays" label="Dias para pagamento" error={errors.paymentDeadlineDays?.message}>
          {(p) => (
            <Input
              {...p}
              {...form.register("paymentDeadlineDays")}
              type="number"
              min={1}
              max={30}
              defaultValue={item?.paymentDeadlineDays ?? 3}
              required
              disabled={locked}
            />
          )}
        </Field>
        <Field id="minInitialBid" label="Lance mínimo (R$)" error={errors.minInitialBid?.message}>
          {(p) => (
            <Input
              {...p}
              {...form.register("minInitialBid")}
              type="number"
              min={1}
              step="0.01"
              defaultValue={item ? item.minInitialBid / 100 : undefined}
              required
              disabled={locked}
            />
          )}
        </Field>
        <Field id="minBidIncrement" label="Incremento mínimo (R$)" error={errors.minBidIncrement?.message}>
          {(p) => (
            <Input
              {...p}
              {...form.register("minBidIncrement")}
              type="number"
              min={1}
              step="0.01"
              defaultValue={item ? item.minBidIncrement / 100 : undefined}
              required
              disabled={locked}
            />
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field id="bidDeadline" label="Prazo para lances" error={errors.bidDeadline?.message}>
            {(p) => (
              <Input
                {...p}
                {...form.register("bidDeadline")}
                type="datetime-local"
                defaultValue={formattedDate}
                required
                disabled={locked}
              />
            )}
          </Field>
        </div>
      </div>
      <Button type="submit" disabled={pending || locked}>{mode === "create" ? "Criar item" : "Salvar alterações"}</Button>
    </form>
    </div>
  );
}
