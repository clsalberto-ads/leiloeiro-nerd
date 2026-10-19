"use client";

import { useCallback, useState } from "react";
import Chat from "./chat-window";

/**
 * Widget flutuante: botão fixo no canto inferior esquerdo
 * que abre/fecha a janela de chat sobre a página.
 */
export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <Chat isOpen={isOpen} onClose={close} />

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Fechar assistente" : "Abrir assistente"}
        aria-expanded={isOpen}
        // ponytail: tokens do tema (o mesmo `primary` dos botões do app), e não
        // cores fixas — as hex hardcoded quebravam o dark mode: o botão mantinha
        // a mesma cara em qualquer tema e a janela virava um retângulo branco
        // num fundo escuro. `ring` substitui o dourado fixo no foco.
        className={`fixed bottom-5 left-5 z-9998 h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none ${
          isOpen ? "hidden sm:flex" : "flex"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
        </svg>
      </button>
    </>
  );
}
