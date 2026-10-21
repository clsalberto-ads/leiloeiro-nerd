"use client";

import Image from "next/image";
import { cn } from "cn";

// ponytail (R2.3): O app tem DOIS tipos de imagem externa e eles pedem
// tratamento oposto:
//   CDN (utfs.io) → next/image: lazy loading, dimensões declaradas, otimização
//   Data URL (QR do MP) → <img> cru com unoptimized: next/image não ganha
//     NADA com um payload base64 já em memória, e ainda exige width/height.
// Este componente centraliza a decisão para os 6 call sites — e é o ÚNICO
// lugar com `eslint-disable` para no-img-element no app inteiro.
export function SmartImage({
  src,
  alt,
  className,
  sizes,
  fill = false,
  width,
  height,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
}) {
  const isDataUrl = src.startsWith("data:");

  if (isDataUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={cn(className)} width={width} height={height} />
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        className={cn("object-cover", className)}
        sizes={sizes ?? "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
        fill
        priority={priority}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={cn(className)}
      width={width ?? 300}
      height={height ?? 300}
      priority={priority}
      sizes={sizes}
    />
  );
}
