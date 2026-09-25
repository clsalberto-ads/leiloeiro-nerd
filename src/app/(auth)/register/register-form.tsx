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
import { signUpAction } from "@/presentation/actions/auth-actions";
import { signUpSchema } from "@/lib/validators";

type SignUpInput = z.input<typeof signUpSchema>;

export function RegisterForm() {
  const [state, action, pending] = useActionState(signUpAction, { ok: false } as { ok?: boolean; error?: string });
  // ponytail: "onTouched" e nao "onBlur" porque reValidateMode so vale com isSubmitted (nunca true sem handleSubmit); revalidar a cada tecla e a unica forma de limpar o erro sem novo blur.
  const form = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema), mode: "onTouched" });
  const { errors } = form.formState;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Cadastre-se como arrematante (você poderá vender depois)</CardDescription>
      </CardHeader>
      <CardContent>
        {/* ponytail: sem gate no submit — a signUpAction segue validando com o signUpSchema; trocar por handleSubmit só se o form sair do server action. */}
        <form action={action} className="space-y-4">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-emerald-600"><Link className="underline" href="/dashboard">Conta criada — entrar no painel</Link></p> : null}
          <Field id="name" label="Nome / Nick" error={errors.name?.message}>
            {(p) => <Input {...p} {...form.register("name")} required />}
          </Field>
          <Field id="email" label="E-mail" error={errors.email?.message}>
            {(p) => <Input {...p} {...form.register("email")} type="email" required />}
          </Field>
          <Field id="password" label="Senha" error={errors.password?.message}>
            {(p) => <Input {...p} {...form.register("password")} type="password" required />}
          </Field>
          <Button type="submit" disabled={pending}>Criar conta</Button>
          <p className="text-sm text-muted-foreground">
            Já tem conta? <Link className="text-primary underline" href="/login">Entrar</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
