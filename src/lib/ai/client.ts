import OpenAI from "openai";

// "openrouter/auto" é o slug válido do roteador da OpenRouter: escolhe o modelo
// disponível conforme a chave. O "openrouter/free" que estava aqui não existe
// como modelo — qualquer chamada sem OPENROUTER_MODEL explícito falhava com 400.
export const MODEL = process.env.OPENROUTER_MODEL ?? "openrouter/auto";

let client: OpenAI | null = null;

export function getOpenRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY não configurada.");
  }
  client ??= new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
  return client;
}
