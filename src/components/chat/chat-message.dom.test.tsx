// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/dom-render";
import ChatMessage, { TypingIndicator } from "./chat-message";
import type { Message } from "@/domain/chat/types/chat";

function msg(role: "user" | "assistant", content: string): Message {
  return { id: `msg-${role}`, role, content };
}

// ponytail: o ChatMessage e o ponto onde o chat encosta no design system —
// `Message` (alinhamento) + `Bubble` (variante). Estes testes seguram o
// contrato VISIVEL: o lado da mensagem e a variante da bolha. A alternativa —
// testar o Bubble — seria testar o proprio shadcn, que ja e testado la.
describe("ChatMessage", () => {
  it("mensagem do usuario alinha a direita com bubble default", () => {
    render(<ChatMessage message={msg("user", "Quero dar um lance")} />);

    const bubble = screen.getByText("Quero dar um lance").closest('[data-slot="bubble"]');
    expect(bubble).not.toBeNull();
    expect(bubble?.getAttribute("data-align")).toBe("end");
    expect(bubble?.getAttribute("data-variant")).toBe("default");
  });

  it("mensagem do assistente alinha a esquerda com bubble outline", () => {
    render(<ChatMessage message={msg("assistant", "Posso ajudar!")} />);

    const bubble = screen.getByText("Posso ajudar!").closest('[data-slot="bubble"]');
    expect(bubble?.getAttribute("data-align")).toBe("start");
    expect(bubble?.getAttribute("data-variant")).toBe("outline");
  });

  it("quebras de linha do usuario sobrevivem (whitespace-pre-wrap)", () => {
    // ponytail: assercao direta no `bubble-content` em vez de `getByText` —
    // o matcher de texto do TL NORMALIZA espacos, e a quebra de linha e
    // exatamente o que este teste precisa conferir CRUA.
    const { container } = render(<ChatMessage message={msg("user", "linha 1\nlinha 2")} />);

    const content = container.querySelector('[data-slot="bubble-content"]');
    expect(content?.textContent).toBe("linha 1\nlinha 2");
    expect(content?.className).toContain("whitespace-pre-wrap");
  });

  it("TypingIndicator anuncia 'Digitando' para leitores de tela", () => {
    render(<TypingIndicator />);

    expect(screen.getByRole("status", { name: "Digitando" })).toBeTruthy();
  });
});
