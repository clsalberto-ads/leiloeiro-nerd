import type OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { chatTools, createMemoizedDeps, executeTool } from "@/lib/ai/tools";

// ponytail: teto de rodadas em que o modelo pode pedir ferramentas. Sem ele, um
// modelo que insiste em chamar a ferramenta (ou um prompt injetado em dados)
// geraria um loop de chamadas pagas. Passando do teto, fazemos uma última
// chamada SEM ferramentas para forçar a resposta em texto.
export const MAX_TOOL_ROUNDS = 3;
// Teto de chamadas atendidas por rodada (o modelo pode pedir várias em paralelo).
export const MAX_CALLS_PER_ROUND = 3;

interface RunOptions {
  client: OpenAI;
  model: string;
  messages: ChatCompletionMessageParam[];
}

/**
 * Conversa com o modelo permitindo Tool Calling. Devolve o texto final (ou
 * `null` se o modelo não respondeu). Erros do provedor sobem para a rota, que
 * já os mapeia para respostas HTTP.
 */
export async function runChatCompletion({
  client,
  model,
  messages,
}: RunOptions): Promise<string | null> {
  const conversation = [...messages];
  const deps = createMemoizedDeps();

  const request = (withTools: boolean) =>
    client.chat.completions.create({
      model,
      temperature: 0.4,
      // ponytail: 800 (e não 500) porque muitos modelos :free da OpenRouter
      // emitem um campo `reasoning` que CONTA no orçamento — com 500, um
      // modelo que "pensa" muito devolvia content:null e o chat respondia
      // "A IA não retornou uma resposta." Ainda é curto: é uma janela de chat.
      max_tokens: 800,
      messages: conversation,
      ...(withTools ? { tools: chatTools } : {}),
    });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const message = (await request(true)).choices[0]?.message;
    // Só chamadas de função registradas; qualquer outro tipo é ignorado.
    const calls = (message?.tool_calls ?? []).filter(
      (c) => c.type === "function",
    );

    if (!message || calls.length === 0) {
      return message?.content?.trim() || null;
    }

    conversation.push({
      role: "assistant",
      content: message.content ?? null,
      tool_calls: message.tool_calls,
    });

    // ponytail: as chamadas de uma rodada são independentes, então rodam em
    // paralelo (antes, em fila). Chamadas idênticas (mesmo nome e argumentos)
    // executam uma vez e dividem o resultado. Cada tool_call_id continua com
    // a sua própria resposta `tool`, que a API exige.
    const running = new Map<string, ReturnType<typeof executeTool>>();
    const results = await Promise.all(
      calls.map((call, i) => {
        // Chamadas além do teto da rodada ainda precisam de uma resposta `tool`,
        // mas não executam consulta.
        if (i >= MAX_CALLS_PER_ROUND) {
          return Promise.resolve({
            error: "Limite de chamadas por rodada excedido.",
          });
        }
        const key = `${call.function.name}\u0000${call.function.arguments}`;
        let pending = running.get(key);
        if (!pending) {
          pending = executeTool(
            call.function.name,
            call.function.arguments,
            deps,
          );
          running.set(key, pending);
        }
        return pending;
      }),
    );
    calls.forEach((call, i) => {
      conversation.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(results[i]),
      });
    });
  }

  // Teto atingido: última chamada sem ferramentas, só para redigir a resposta.
  const final = (await request(false)).choices[0]?.message?.content?.trim();
  return final || null;
}
