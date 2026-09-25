"use client";

import { useActionState, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { createSlug } from "@/domain/value-objects/slug";
import { becomeSellerAction } from "@/presentation/actions/profile-actions";
import { becomeSellerSchema } from "@/lib/validators";

// ponytail: o slug tem transform (trim + createSlug) no becomeSellerSchema, o
// que exige a forma de 3 generics do useForm mesmo sem handleSubmit — o
// `z.input` e o `z.output` do form sao o valor digitado e o slug normalizado.
type BecomeSellerInput = z.input<typeof becomeSellerSchema>;
type BecomeSellerOutput = z.output<typeof becomeSellerSchema>;

export function BecomeSellerForm() {
  const [state, action, pending] = useActionState(becomeSellerAction, null as { error?: string; ok?: boolean } | null);
  const form = useForm<BecomeSellerInput, unknown, BecomeSellerOutput>({
    resolver: zodResolver(becomeSellerSchema),
    // ponytail: mode onTouched — ver rationale em item-form.tsx
    mode: "onTouched",
    defaultValues: { slug: "", role: "seller" },
  });
  const { errors } = form.formState;
  // ponytail: `useWatch` e nao `form.watch()` porque o lint de react-hooks marca o
  // `watch` como incompativel com o React Compiler.
  const slug = useWatch({ control: form.control, name: "slug" });

  // ponytail: o preview e o `createSlug` sobre o valor atual do campo, entao
  // recalcula a cada tecla; o try/catch esconde o texto que nao vira slug
  // (so pontuacao, por exemplo) em vez de derrubar o form.
  const preview = useMemo(() => {
    try {
      return createSlug(slug);
    } catch {
      return "";
    }
  }, [slug]);

  return (
    // ponytail: sem gate no submit — a becomeSellerAction segue validando com o becomeSellerSchema; trocar por handleSubmit só se o form sair do server action.
    <form action={action} className="max-w-md space-y-4">
      {state && "error" in state && state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      {state && state.ok ? <p className="text-sm text-emerald-600">Conta de leiloeiro ativada.</p> : null}
      <div className="space-y-2">
        <Field id="slug" label="Slug da vitrine" error={errors.slug?.message}>
          {(p) => <Input {...p} {...form.register("slug")} placeholder="nerd-colecionaveis" />}
        </Field>
        {preview ? <p className="text-sm text-muted-foreground">leiloeironerd.com/{preview}</p> : null}
      </div>
      <div className="space-y-2">
        <Field id="role" label="Ativar como" error={errors.role?.message}>
          {(p) => (
            <select
              {...p}
              {...form.register("role")}
              defaultValue="seller"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50 aria-invalid:border-destructive"
            >
              <option value="seller">Leiloeiro</option>
              <option value="both">Leiloeiro e arrematante</option>
            </select>
          )}
        </Field>
      </div>
      <Button type="submit" disabled={pending}>Ativar conta de leiloeiro</Button>
    </form>
  );
}
