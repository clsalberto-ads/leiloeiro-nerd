import { NextResponse } from "next/server";
import { getOpenRouterClient, MODEL } from "@/lib/ai/client";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import {
  KnowledgeIndexNotFoundError,
  buildContextBlock,
  searchKnowledge,
} from "@/lib/rag";
import type {
  ApiMessage,
  ChatErrorBody,
  ChatResponseBody,
} from "@/domain/chat/types/chat";

export const runtime = "nodejs";

const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 2000;

function sanitizeMessages(input: unknown): ApiMessage[] | null {
  if (!Array.isArray(input)) return null;

  const cleaned: ApiMessage[] = [];
  for (const item of input) {
    if (typeof item !== "object" || item === null) return null;
    const { role, content } = item as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    const text = content.trim().slice(0, MAX_CONTENT_LENGTH);
    if (text) cleaned.push({ role, content: text });
  }

  const recent = cleaned.slice(-MAX_MESSAGES);
  if (recent.length === 0 || recent[recent.length - 1].role !== "user") {
    return null;
  }
  return recent;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json<ChatErrorBody>({ error }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Corpo da requisição inválido.", 400);
  }

  const messages = sanitizeMessages(
    (body as { messages?: unknown } | null)?.messages,
  );
  if (!messages) {
    return errorResponse("Envie uma lista válida de mensagens.", 400);
  }

  // A última mensagem é garantidamente do usuário (ver sanitizeMessages acima).
  const question = messages[messages.length - 1].content;

  let context: string | null = null;
  try {
    const results = await searchKnowledge(question);
    context = buildContextBlock(results);
  } catch (err) {
    if (err instanceof KnowledgeIndexNotFoundError) {
      console.error("[api/chat]", err.message);
      return errorResponse(
        'Base de conhecimento ainda não indexada. Execute "pnpm knowledge:index" e tente novamente.',
        500,
      );
    }
    // Uma falha pontual na busca (ex.: API de embeddings fora do ar) não deve
    // derrubar o chat: seguimos sem contexto, e o prompt instrui a IA a dizer
    // que não encontrou a informação em vez de inventar uma resposta.
    console.error("[api/chat] Falha ao buscar na base de conhecimento:", err);
  }

  try {
    const completion = await getOpenRouterClient().chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      max_tokens: 500,
      messages: [
        { role: "system", content: buildSystemPrompt(context) },
        ...messages,
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) {
      return errorResponse("A IA não retornou uma resposta.", 502);
    }

    return NextResponse.json<ChatResponseBody>({ message: reply });
  } catch (err) {
    console.error("[api/chat]", err);
    // ponytail: a checagem original comparava contra "OPENAI_API_KEY", mas o
    // cliente de chat (getOpenRouterClient) lança "OPENROUTER_API_KEY não
    // configurada." — substring diferente, então essa branch nunca disparava
    // e uma chave ausente sempre voltava 502 em vez de 500. Corrigido aqui.
    const isConfig =
      err instanceof Error && err.message.includes("OPENROUTER_API_KEY");
    return errorResponse(
      "Não foi possível processar sua mensagem.",
      isConfig ? 500 : 502,
    );
  }
}
