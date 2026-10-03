"use client";

import { Heart } from "lucide-react";
import { useActionState } from "react";
import { toggleFavoriteAction } from "@/presentation/actions/favorite-actions";
import { Button } from "@/components/ui/button";

export function FavoriteButton({
  itemId,
  initialFavorited = false,
}: {
  itemId: string;
  initialFavorited?: boolean;
}) {
  const [state, formAction, pending] = useActionState(toggleFavoriteAction, null);

  const favorited = (state as { favorited?: boolean } | null)?.favorited ?? initialFavorited;

  return (
    <form action={formAction}>
      <input type="hidden" name="itemId" value={itemId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-pressed={favorited}
        aria-label={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      >
        <Heart className={`h-5 w-5 ${favorited ? "fill-red-500 text-red-500" : ""}`} />
      </Button>
    </form>
  );
}
