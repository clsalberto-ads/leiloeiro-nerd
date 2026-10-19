"use client";

import { useCallback, useState } from "react";
import { MessageCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Chat from "./chat-window";

/**
 * Widget flutuante: botão fixo no canto inferior direito
 * que abre/fecha a janela de chat sobre a página.
 *
 * ponytail: o botão é o `Button` do design system (variante default =
 * bg-primary/text-primary-foreground, hover e foco do DS) com ícone lucide —
 * o SVG inline e as classes de cor manuais que estavam aqui eram a mesma
 * coisa reescrita. Só o posicionamento (`fixed bottom-5 right-5` + tamanho
 * 14) e o `hover:scale-105` são locais: o DS não tem variante "botão
 * flutuante", e esses dois não pertencem a ele.
 */
export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <Chat isOpen={isOpen} onClose={close} />

      <Button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Fechar assistente" : "Abrir assistente"}
        aria-expanded={isOpen}
        size="icon-lg"
        className={`fixed bottom-5 right-5 z-9998 h-14 w-14 rounded-full shadow-lg transition hover:scale-105 motion-reduce:transition-none ${
          isOpen ? "hidden sm:flex" : "flex"
        }`}
      >
        <MessageCircleIcon aria-hidden="true" className="size-6" />
      </Button>
    </>
  );
}
