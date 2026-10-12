import OpenAI from "openai";

export const MODEL = process.env.OPENROUTER_MODEL ?? "openrouter/free";

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
