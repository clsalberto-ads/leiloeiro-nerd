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
        className={`fixed bottom-5 left-5 z-9998 h-14 w-14 items-center justify-center rounded-full bg-[#1c2b3a] text-[#e3b95a] shadow-lg transition hover:scale-105 hover:bg-[#2a3f55] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b8892b] motion-reduce:transition-none ${
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
