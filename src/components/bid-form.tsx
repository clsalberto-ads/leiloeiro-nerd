"use client";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { placeBidAction } from "@/presentation/actions/bid-actions";
import { formatReais } from "@/lib/format-reais";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BidFormProps {
  itemId: string;
  minBid: number;
}

export function BidForm({ itemId, minBid }: BidFormProps) {
  const [state, formAction, pending] = useActionState(placeBidAction, null);
  const minReais = formatReais(minBid);
  const [centavos, setCentavos] = useState(minBid);

  useEffect(() => {
    if (state && state.ok) {
      toast.success("Lance registrado!");
      setCentavos(minBid); // Reset bid amount after success
    } else if (state && state.error) {
      toast.error(state.error);
    }
    // ponytail: accessibility constraint (DOM alert must stay) - the toast is visual-only, in-DOM alert for screen readers
  }, [state, minBid]);

  return (
    <form action={formAction} className="space-y-3">
      {state && "error" in state && state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-emerald-600">Lance registrado!</p>}
      <div className="space-y-2">
        <Label htmlFor="amount">Seu lance (R$)</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min={minBid / 100}
          placeholder={`Mínimo R$ ${minReais}`}
          required
          disabled={pending}
          onChange={(e) => setCentavos(Math.round(Number(e.target.value) * 100))}
        />
        <input type="hidden" name="amount" value={centavos} />
        <input type="hidden" name="itemId" value={itemId} />
      </div>
      <Button type="submit" disabled={pending}>Dar lance</Button>
    </form>
  );
}