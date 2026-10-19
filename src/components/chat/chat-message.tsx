import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import type { Message as ChatMessageData } from "@/domain/chat/types/chat";

// ponytail: a bolha é o `Bubble` do design system (variante `default` =
// bg-primary/text-primary-foreground para o usuário; `outline` para o
// assistente), dentro do `Message`/`MessageContent` que cuidam do alinhamento.
// `whitespace-pre-wrap` é acréscimo local: o BubbleContent do DS resolve quebra
// de palavra, mas o usuário pode digitar quebras de linha — e elas precisam
// sobreviver até a tela.
export default function ChatMessage({ message }: { message: ChatMessageData }) {
  const isUser = message.role === "user";

  return (
    <Message align={isUser ? "end" : "start"}>
      <MessageContent>
        <Bubble
          variant={isUser ? "default" : "outline"}
          align={isUser ? "end" : "start"}
        >
          <BubbleContent className="whitespace-pre-wrap">
            {message.content}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

export function TypingIndicator() {
  return (
    <Message align="start">
      <MessageContent>
        <Bubble variant="muted">
          <BubbleContent
            role="status"
            aria-label="Digitando"
            className="flex items-center gap-1 px-4 py-3"
          >
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}
