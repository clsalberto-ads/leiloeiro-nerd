"use client";

import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { forgotPasswordAction } from "@/presentation/actions/auth-actions";
import { forgotPasswordSchema } from "@/lib/validators";

type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, { ok: false } as { ok?: boolean; error?: string });
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    // ponytail: mode onTouched — ver rationale em item-form.tsx
    mode: "onTouched",
  });
  const { errors } = form.formState;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Recuperar senha</CardTitle>
        <CardDescription>Informe seu e-mail para receber as instruções</CardDescription>
      </CardHeader>
      <CardContent>
        {/* ponytail: sem gate no submit — a forgotPasswordAction segue validando com o forgotPasswordSchema; trocar por handleSubmit só se o form sair do server action. */}
        <form action={action} className="space-y-4">
          {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-emerald-600">Enviamos as instruções para seu e-mail.</p> : null}
          <Field id="email" label="E-mail" error={errors.email?.message}>
            {(p) => <Input {...p} {...form.register("email")} type="email" required />}
          </Field>
          <Button type="submit" disabled={pending}>Enviar instruções</Button>
        </form>
      </CardContent>
    </Card>
  );
}
