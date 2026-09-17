"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSlug } from "@/domain/value-objects/slug";
import { becomeSellerAction } from "@/presentation/actions/profile-actions";

export function BecomeSellerForm() {
  const [state, action, pending] = useActionState(becomeSellerAction, null as { error?: string; ok?: boolean } | null);
  const [raw, setRaw] = useState("");

  let preview = "";
  try {
    preview = createSlug(raw);
  } catch {
    preview = "";
  }

  return (
    <form action={action} className="max-w-md space-y-4">
      {state && "error" in state && state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state && state.ok ? <p className="text-sm text-emerald-600">Conta de leiloeiro ativada.</p> : null}
      <div className="space-y-2">
        <Label htmlFor="slug">Slug da vitrine</Label>
        <Input id="slug" name="slug" placeholder="nerd-colecionaveis" value={raw} onChange={(e) => setRaw(e.target.value)} />
        {preview ? <p className="text-sm text-muted-foreground">leiloeironerd.com/{preview}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Ativar como</Label>
        <select id="role" name="role" className="w-full rounded-md border bg-background px-3 py-2 text-sm" defaultValue="seller">
          <option value="seller">Leiloeiro</option>
          <option value="both">Leiloeiro e arrematante</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>Ativar conta de leiloeiro</Button>
    </form>
  );
}
