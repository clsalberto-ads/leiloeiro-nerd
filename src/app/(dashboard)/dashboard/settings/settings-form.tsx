"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "@/presentation/actions/profile-actions";

// ponytail: os `defaultValue` NAO eram opcionais antes — o componente nao recebia
// nada e os quatro campos renderizavam vazios, com o usuario logado, numa tela
// cuja finalidade e mostrar e editar o proprio perfil. Pior: como o `profileSchema`
// traduz `""` para `undefined` ("nao mexer neste campo"), o Salvar sem digitar nada
// era um no-op silencioso — o usuario via "Perfil atualizado." sem que nada
// tivesse sido conferido, e sem nenhuma pista do que o campo continha.
//
// A pagina (server component) e quem tem a sessao, entao e ela que passa. O
// `defaultValue` em vez de `value` mantem o campo editavel: `value` +
// `updateProfileAction` sao um controlled input cujo estado vive no servidor, e
// cada tecla passaria por uma action de servidor.
export interface SettingsProfile {
  name: string;
  slug: string | null;
  phone: string | null;
  address: string | null;
}

export function SettingsForm({ profile }: { profile: SettingsProfile }) {
  const [state, action, pending] = useActionState(updateProfileAction, null as { error?: string; ok?: boolean } | null);

  return (
    <form action={action} className="max-w-md space-y-4">
      {/* ponytail: `role="alert"` — o mesmo dos outros sete formularios do projeto. */}
      {state && "error" in state && state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state && state.ok ? <p className="text-sm text-emerald-600">Perfil atualizado.</p> : null}
      <div className="space-y-2">
        <Label htmlFor="name">Nome / Nick</Label>
        <Input id="name" name="name" defaultValue={profile.name} placeholder="Como você quer aparecer" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Slug da vitrine (se for leiloeiro)</Label>
        <Input id="slug" name="slug" defaultValue={profile.slug ?? ""} placeholder="nerd-colecionaveis" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Celular</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} placeholder="+55 11 99999-0000" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Endereço (opcional)</Label>
        <Input id="address" name="address" defaultValue={profile.address ?? ""} placeholder="Cidade / UF" />
      </div>
      <Button type="submit" disabled={pending}>Salvar</Button>
    </form>
  );
}