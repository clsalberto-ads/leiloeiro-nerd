import OpenAI from "openai";

/**
 * Cliente (SDK da OpenAI) dedicado aos embeddings do RAG.
 *
 * Separado do cliente de chat em `@/lib/ai/client.ts`: aquele fala com a
 * OpenRouter (OPENROUTER_API_KEY) para gerar a resposta final. Os embeddings
 * usam o endpoint compatível com OpenAI do Gemini (camada gratuita), com a
 * chave própria OPENAI_GEMINI_API_KEY — as duas chamadas são independentes.
 * Para voltar à OpenAI, basta trocar a chave, OPENAI_BASE_URL e o modelo.
 */
export const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "gemini-embedding-001";

let client: OpenAI | null = null;

export function getOpenAIEmbeddingsClient(): OpenAI {
  const apiKey = process.env.OPENAI_GEMINI_API_KEY;
  const baseURL =
    process.env.OPENAI_BASE_URL ??
    "https://generativelanguage.googleapis.com/v1beta/openai/";
  if (!apiKey) {
    throw new Error("OPENAI_GEMINI_API_KEY não configurada.");
  }
  client ??= new OpenAI({
    apiKey,
    baseURL,
  });
  return client;
}
