"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpAction } from "@/presentation/actions/auth-actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState(signUpAction, { ok: false } as { ok?: boolean; error?: string });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Cadastre-se como arrematante (você poderá vender depois)</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-emerald-600"><Link className="underline" href="/dashboard">Conta criada — entrar no painel</Link></p> : null}
          <div className="space-y-2">
            <Label htmlFor="name">Nome / Nick</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <Button type="submit" disabled={pending}>Criar conta</Button>
          <p className="text-sm text-muted-foreground">
            Já tem conta? <Link className="text-primary underline" href="/login">Entrar</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}