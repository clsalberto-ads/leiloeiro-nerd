"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

interface FieldRenderProps {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: (props: FieldRenderProps) => ReactNode;
}

export function Field({ id, label, error, hint, children }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
