"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "@/presentation/actions/profile-actions";

export function SettingsForm() {
  const [state, action, pending] = useActionState(updateProfileAction, null as { error?: string; ok?: boolean } | null);

  return (
    <form action={action} className="max-w-md space-y-4">
      {state && "error" in state && state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state && state.ok ? <p className="text-sm text-emerald-600">Perfil atualizado.</p> : null}
      <div className="space-y-2">
        <Label htmlFor="name">Nome / Nick</Label>
        <Input id="name" name="name" placeholder="Como você quer aparecer" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Slug da vitrine (se for leiloeiro)</Label>
        <Input id="slug" name="slug" placeholder="nerd-colecionaveis" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Celular</Label>
        <Input id="phone" name="phone" type="tel" placeholder="+55 11 99999-0000" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Endereço (opcional)</Label>
        <Input id="address" name="address" placeholder="Cidade / UF" />
      </div>
      <Button type="submit" disabled={pending}>Salvar</Button>
    </form>
  );
}