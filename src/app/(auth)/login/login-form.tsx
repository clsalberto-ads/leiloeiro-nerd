"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { signInAction } from "@/presentation/actions/auth-actions";
import { signInSchema } from "@/lib/validators";

type SignInInput = z.input<typeof signInSchema>;

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, { ok: false } as { ok?: boolean; error?: string });
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    // ponytail: mode onTouched — ver rationale em item-form.tsx
    mode: "onTouched",
  });
  const { errors } = form.formState;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse sua conta no Leiloeiro Nerd</CardDescription>
      </CardHeader>
      <CardContent>
        {/* ponytail: sem gate no submit — a signInAction segue validando com o signInSchema; trocar por handleSubmit só se o form sair do server action. */}
        <form action={action} className="space-y-4">
          {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-emerald-600"><Link className="underline" href="/dashboard">Entrar no painel</Link></p> : null}
          <Field id="email" label="E-mail" error={errors.email?.message}>
            {(p) => <Input {...p} {...form.register("email")} type="email" required />}
          </Field>
          <Field id="password" label="Senha" error={errors.password?.message}>
            {(p) => <Input {...p} {...form.register("password")} type="password" required />}
          </Field>
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
