import OpenAI from "openai";

/**
 * Cliente (SDK da OpenAI) dedicado aos embeddings do RAG.
 *
 * Separado do cliente de chat em `@/lib/ai/client.ts`: aquele fala com a
 * OpenRouter (OPENROUTER_API_KEY) para gerar a resposta final. Os embeddings
 * usam o endpoint compatível com OpenAI do Gemini (camada gratuita), com a
 * chave própria GEMINI_API_KEY — as duas chamadas são independentes.
 * Para voltar à OpenAI de verdade, basta trocar a chave, OPENAI_BASE_URL e o
 * modelo.
 *
 * ponytail: o nome PRIMÁRIO é `GEMINI_API_KEY`/`EMBEDDING_MODEL` — o antigo
 * `OPENAI_GEMINI_API_KEY`/`OPENAI_EMBEDDING_MODEL` ficava como fallback por
 * compatibilidade com quem já tinha preenchido. O nome antigo dizia "OpenAI"
 * para uma chave do Gemini, e foi exatamente a confusão que aconteceu: o
 * `.env` foi preenchido com `GEMINI_API_KEY` (nome certo), o código continuou
 * lendo o outro, e a chave válida era ignorada em silêncio.
 */
export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ??
  process.env.OPENAI_EMBEDDING_MODEL ??
  "gemini-embedding-001";

let client: OpenAI | null = null;

export function getOpenAIEmbeddingsClient(): OpenAI {
  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.OPENAI_GEMINI_API_KEY;
  const baseURL =
    process.env.OPENAI_BASE_URL ??
    "https://generativelanguage.googleapis.com/v1beta/openai/";
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada.");
  }
  client ??= new OpenAI({
    apiKey,
    baseURL,
  });
  return client;
}
