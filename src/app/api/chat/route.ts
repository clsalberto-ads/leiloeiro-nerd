import { NextResponse } from "next/server";
import { getOpenRouterClient, MODEL } from "@/lib/ai/client";
import { runChatCompletion } from "@/lib/ai/chat-completion";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import {
  KnowledgeIndexNotFoundError,
  buildContextBlock,
  searchKnowledge,
} from "@/lib/rag";
import { isRateLimited } from "@/lib/rate-limit";
import type {
  ApiMessage,
  ChatErrorBody,
  ChatResponseBody,
} from "@/domain/chat/types/chat";

export const runtime = "nodejs";

const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 2000;

// ponytail: cada POST aqui dispara UMA chamada de embeddings + UMA de LLM —
// ambos pagos. Sem este teto, um `while true; curl` queima a cota do projeto
// em minutos. 30/min/IP é muito acima do ritmo de uma conversa humana (uma
// pergunta a cada 2s, sem parar, por um minuto inteiro) e muito abaixo do que
// um script consegue produzir. O limitador em si é o `rate-limit.ts` (memória
// local, por processo — a nota lá explica o trade-off).
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

/**
 * IP do cliente atrás de proxies. Em produção (Vercel/NGINX) o IP real chega
 * no `x-forwarded-for` (primeiro hop da lista); `request.headers.get` nunca
 * lança, e o fallback "unknown" agrupa quem chega sem os headers — para esses
 * o limite vale coletivamente, o que é o lado seguro do erro.
 */
function clientKeyOf(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

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
  // O rate limit vem ANTES de qualquer parse: recusar um golpe não pode
  // gastar nem o custo de ler o corpo — e muito menos uma chamada de API.
  if (isRateLimited(clientKeyOf(request), RATE_LIMIT, RATE_WINDOW_MS)) {
    return errorResponse(
      "Muitas mensagens seguidas. Aguarde um instante e tente novamente.",
      429,
    );
  }

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
    // ponytail: a chamada única ao modelo virou `runChatCompletion`, que
    // também atende pedidos de ferramenta (ex.: search_active_items) com limite
    // de rodadas. Sem pedido de ferramenta, é exatamente uma chamada, como antes.
    const reply = await runChatCompletion({
      client: getOpenRouterClient(),
      model: MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt(context) },
        ...messages,
      ],
    });
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
    if (isConfig) {
      return errorResponse(
        "Assistente não configurado: preencha OPENROUTER_API_KEY no .env.",
        500,
      );
    }
    // ponytail: sem este mapeamento, TODO erro da OpenRouter virava o genérico
    // "Não foi possível processar sua mensagem." — e o 402 (conta sem
    // créditos, o caso mais comum em conta nova) ficava indistinguível de um
    // 500 qualquer. A mensagem devolvida aqui vai direto para o widget, então
    // ela precisa dizer O QUE fazer, não só o que falhou.
    const status =
      typeof err === "object" && err !== null && "status" in err
        ? (err as { status?: unknown }).status
        : undefined;
    if (status === 402) {
      return errorResponse(
        'A conta da OpenRouter está sem créditos. Adicione créditos em openrouter.ai/settings/credits ou configure um modelo gratuito (sufixo ":free") em OPENROUTER_MODEL, no .env.',
        502,
      );
    }
    if (status === 401) {
      return errorResponse(
        "Chave da OpenRouter inválida. Confira OPENROUTER_API_KEY no .env.",
        502,
      );
    }
    if (status === 429) {
      return errorResponse(
        "Muitas requisições à IA em pouco tempo. Aguarde um instante e tente de novo.",
        502,
      );
    }
    return errorResponse("Não foi possível processar sua mensagem.", 502);
  }
}
