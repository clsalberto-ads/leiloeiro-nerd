"use client";

import { useState } from "react";
import { SmartImage } from "@/components/smart-image";

export function ItemGallery({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
        Sem imagens
      </div>
    );
  }

  const current = images[active] ?? images[0]!;

  return (
    <div className="space-y-3">
      <div className="aspect-square w-full overflow-hidden rounded-lg border">
        <SmartImage src={current} alt="Imagem do item" fill className="h-full w-full" />
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver imagem ${i + 1}`}
              className={`h-20 w-20 overflow-hidden rounded-md border ${i === active ? "ring-2 ring-ring" : "opacity-70 hover:opacity-100"}`}
            >
              <SmartImage src={src} alt="" fill className="h-full w-full" sizes="80px" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}