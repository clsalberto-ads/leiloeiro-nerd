"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SendHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export default function ChatInput({
  onSend,
  disabled = false,
  autoFocus = false,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  // Cresce com o texto, até um limite. `field-sizing-fixed` DESLIGA o
  // `field-sizing-content` que o Textarea do design system traz (suporte de
  // navegador ainda parcial) e deixa o crescimento para cá — que funciona
  // em todos. O `min-h-10` sobrepõe o `min-h-16` base: uma linha de entrada
  // em janela pequena não pode valer duas.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Ignora Enter usado para confirmar composição (IME).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-border bg-card p-3">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        maxLength={2000}
        placeholder="Digite sua pergunta..."
        aria-label="Mensagem"
        className="max-h-30 min-h-10 field-sizing-fixed resize-none"
      />
      <Button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        size="icon"
        aria-label="Enviar mensagem"
      >
        <SendHorizontalIcon aria-hidden="true" />
      </Button>
    </div>
  );
}
