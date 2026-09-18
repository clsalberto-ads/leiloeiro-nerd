"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "@/presentation/actions/auth-actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, { ok: false } as { ok?: boolean; error?: string });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse sua conta no Leiloeiro Nerd</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-emerald-600"><Link className="underline" href="/dashboard">Entrar no painel</Link></p> : null}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <Button type="submit" disabled={pending}>Entrar</Button>
          <p className="text-sm text-muted-foreground">
            Não tem conta? <Link className="text-primary underline" href="/register">Cadastre-se</Link> ·{" "}
            <Link className="text-primary underline" href="/forgot-password">Esqueci a senha</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}