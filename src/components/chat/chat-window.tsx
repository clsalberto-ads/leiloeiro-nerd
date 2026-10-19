"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ApiMessage,
  ChatErrorBody,
  ChatResponseBody,
  Message,
} from "@/domain/chat/types/chat";
import ChatInput from "./chat-input";
import ChatMessage, { TypingIndicator } from "./chat-message";

const GREETING: Message = {
  id: "greeting",
  role: "assistant",
  content: "Olá! 👋 Como posso ajudar?",
};

const ERROR_TEXT = "Não foi possível processar sua mensagem. Tente novamente.";

interface ChatProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Janela de chat. Permanece montada mesmo fechada,
 * assim o histórico da sessão não se perde ao fechar o widget.
 */
export default function Chat({ isOpen, onClose }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Rola para a mensagem mais recente.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, error, isOpen]);

  // Fecha com Esc.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  async function handleSend(text: string) {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const next = [...messages, userMessage];
    setMessages(next);
    setError(null);
    setIsLoading(true);

    // A saudação inicial é só da interface; não vai para a IA.
    const payload: ApiMessage[] = next
      .filter((m) => m.id !== GREETING.id)
      .map(({ role, content }) => ({ role, content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      });

      if (!res.ok) {
        const data = (await res
          .json()
          .catch(() => null)) as ChatErrorBody | null;
        throw new Error(data?.error ?? ERROR_TEXT);
      }

      const data = (await res.json()) as ChatResponseBody;
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: data.message },
      ]);
    } catch {
      setError(ERROR_TEXT);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section
      role="dialog"
      aria-label="Assistente virtual"
      hidden={!isOpen}
      className="fixed inset-0 z-9999 flex flex-col overflow-hidden bg-slate-50 shadow-2xl sm:inset-auto sm:bottom-24 sm:left-5 sm:h-[min(500px,calc(100dvh-7rem))] sm:w-90 sm:rounded-2xl sm:border sm:border-slate-200 [[hidden]]:hidden"
    >
      <header className="flex items-center justify-between bg-[#1c2b3a] px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full bg-[#b8892b]"
            aria-hidden="true"
          />
          <h2 className="text-sm font-semibold">Assistente Virtual</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar chat"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#b8892b]"
        >
          ×
        </button>
      </header>

      <div
        className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
        aria-live="polite"
      >
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {isLoading && <TypingIndicator />}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={isLoading} autoFocus={isOpen} />
    </section>
  );
}
