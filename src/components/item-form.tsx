"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createItemAction, updateItemAction } from "@/presentation/actions/item-actions";
import { uploadItemImagesAction } from "@/presentation/actions/upload-actions";
import type { Item } from "@/domain/repositories/item-repository";

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
    if (state && state.ok) {
      router.push("/dashboard/items");
      toast.success(mode === "create" ? "Item criado com sucesso!" : "Item atualizado com sucesso!");
    } else if (state && state.error) {
      toast.error(state.error);
    }
    // ponytail: accessibility constraint (DOM alert must stay) - the toast is visual-only, in-DOM alert for screen readers
  }, [state, router, mode]);

  const uploaded = uploadState?.urls;
  if (uploaded?.length && uploaded !== absorbedUpload) {
    setAbsorbedUpload(uploaded);
    setUrls((prev) => [...prev, ...uploaded]);
  }

  const removeUrl = (url: string) => setUrls((prev) => prev.filter((u) => u !== url));

  const formattedDate = item?.bidDeadline
    ? new Date(item.bidDeadline.getTime() - item.bidDeadline.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : undefined;

  return (
    <div className="max-w-xl space-y-4">
      {!locked ? (
        <form action={uploadAction} className="space-y-2">
          <Label htmlFor="images">Imagens</Label>
          <div className="flex items-center gap-2">
            <Input id="images" name="images" type="file" accept="image/*" multiple disabled={uploadPending} />
            <Button type="submit" disabled={uploadPending}>{uploadPending ? "Enviando…" : "Enviar"}</Button>
          </div>
          {uploadState?.error ? <p className="text-sm text-destructive">{uploadState.error}</p> : null}
        </form>
      ) : null}
      <form action={formAction} className="space-y-4">
        {state && "error" in state && state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        {locked ? <p className="text-sm text-amber-600">Item publicado — edição bloqueada.</p> : null}
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
      <div className={locked ? "grid grid-cols-1 gap-4 opacity-60 sm:grid-cols-2" : "grid grid-cols-1 gap-4 sm:grid-cols-2"}>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Título</Label>
          <Input id="title" name="title" defaultValue={item?.title} required maxLength={150} disabled={locked} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Descrição</Label>
          <textarea
            id="description"
            name="description"
            defaultValue={item?.description}
            required
            minLength={10}
            maxLength={5000}
            rows={4}
            disabled={locked}
            className="rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <select id="type" name="type" defaultValue={item?.type ?? "product"} required disabled={locked} className="rounded-md border bg-background px-3 py-2 text-sm">
            <option value="product">Produto</option>
            <option value="service">Serviço</option>
            <option value="piece">Peça colecionável</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="paymentDeadlineDays">Dias para pagamento</Label>
          <Input id="paymentDeadlineDays" name="paymentDeadlineDays" type="number" min={1} max={30} defaultValue={item?.paymentDeadlineDays ?? 3} required disabled={locked} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minInitialBid">Lance mínimo (R$)</Label>
          <Input id="minInitialBid" name="minInitialBid" type="number" min={1} step="0.01" defaultValue={item ? item.minInitialBid / 100 : undefined} required disabled={locked} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minBidIncrement">Incremento mínimo (R$)</Label>
          <Input id="minBidIncrement" name="minBidIncrement" type="number" min={1} step="0.01" defaultValue={item ? item.minBidIncrement / 100 : undefined} required disabled={locked} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="bidDeadline">Prazo para lances</Label>
          <Input id="bidDeadline" name="bidDeadline" type="datetime-local" defaultValue={formattedDate} required disabled={locked} />
        </div>
      </div>
      <Button type="submit" disabled={pending || locked}>{mode === "create" ? "Criar item" : "Salvar alterações"}</Button>
    </form>
    </div>
  );
}
