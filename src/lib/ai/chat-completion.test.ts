import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeTool } = vi.hoisted(() => ({ executeTool: vi.fn() }));
vi.mock("@/lib/ai/tools", () => ({
  chatTools: [
    {
      type: "function",
      function: { name: "search_active_items", parameters: {} },
    },
  ],
  executeTool,
  createMemoizedDeps: () => "deps",
}));

import {
  MAX_CALLS_PER_ROUND,
  MAX_TOOL_ROUNDS,
  runChatCompletion,
} from "./chat-completion";
import type OpenAI from "openai";

const create = vi.fn();
const client = { chat: { completions: { create } } } as unknown as OpenAI;
const messages = [
  { role: "system" as const, content: "sys" },
  { role: "user" as const, content: "Quais itens estão ativos?" },
];

const text = (content: string | null) => ({
  choices: [{ message: { role: "assistant", content } }],
});
const toolCall = (id: string, name = "search_active_items", args = "{}") => ({
  id,
  type: "function",
  function: { name, arguments: args },
});
const wantsTools = (...calls: ReturnType<typeof toolCall>[]) => ({
  choices: [
    { message: { role: "assistant", content: null, tool_calls: calls } },
  ],
});

describe("runChatCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    executeTool.mockResolvedValue({ items: [], returned: 0, totalMatching: 0 });
  });

  it("sem pedido de ferramenta, faz uma única chamada com a ferramenta disponível", async () => {
    create.mockResolvedValueOnce(text("  Olá!  "));

    expect(await runChatCompletion({ client, model: "m", messages })).toBe(
      "Olá!",
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].tools).toHaveLength(1);
    expect(executeTool).not.toHaveBeenCalled();
  });

  it("executa a ferramenta pedida e devolve o resultado ao modelo", async () => {
    executeTool.mockResolvedValue({
      items: [{ ref: "item-1" }],
      returned: 1,
      totalMatching: 1,
    });
    create
      .mockResolvedValueOnce(
        wantsTools(toolCall("call_1", "search_active_items", '{"limit":3}')),
      )
      .mockResolvedValueOnce(text("Há 1 item ativo."));

    const reply = await runChatCompletion({ client, model: "m", messages });

    expect(reply).toBe("Há 1 item ativo.");
    expect(executeTool).toHaveBeenCalledWith(
      "search_active_items",
      '{"limit":3}',
      "deps",
    );

    // O historico enviado na 2ª chamada tem o pedido do assistente e a resposta da ferramenta.
    const second = create.mock.calls[1][0].messages;
    expect(second.at(-2)).toMatchObject({
      role: "assistant",
      tool_calls: [{ id: "call_1" }],
    });
    expect(second.at(-1)).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: JSON.stringify({
        items: [{ ref: "item-1" }],
        returned: 1,
        totalMatching: 1,
      }),
    });
  });

  it("termina assim que o modelo dá a resposta final (não chama mais nada)", async () => {
    create
      .mockResolvedValueOnce(wantsTools(toolCall("a")))
      .mockResolvedValueOnce(text("pronto"));

    await runChatCompletion({ client, model: "m", messages });

    expect(create).toHaveBeenCalledTimes(2);
    expect(executeTool).toHaveBeenCalledTimes(1);
  });

  it("interrompe o loop de ferramentas e força uma resposta sem ferramentas", async () => {
    create.mockImplementation(async (params: { tools?: unknown }) =>
      params.tools ? wantsTools(toolCall("loop")) : text("resposta forçada"),
    );

    const reply = await runChatCompletion({ client, model: "m", messages });

    expect(reply).toBe("resposta forçada");
    expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    expect(create).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1);
    expect(create.mock.calls.at(-1)![0].tools).toBeUndefined();
  });

  it("limita as chamadas por rodada, mas responde a todas as tool_calls", async () => {
    const calls = Array.from({ length: MAX_CALLS_PER_ROUND + 2 }, (_, i) =>
      toolCall(`c${i}`, "search_active_items", `{"limit":${i + 1}}`),
    );
    create
      .mockResolvedValueOnce(wantsTools(...calls))
      .mockResolvedValueOnce(text("ok"));

    await runChatCompletion({ client, model: "m", messages });

    expect(executeTool).toHaveBeenCalledTimes(MAX_CALLS_PER_ROUND);
    const toolMessages = create.mock.calls[1][0].messages.filter(
      (m: { role: string }) => m.role === "tool",
    );
    expect(toolMessages).toHaveLength(calls.length);
  });

  it("ferramenta desconhecida é repassada ao executor, que a recusa", async () => {
    executeTool.mockResolvedValue({ error: "Ferramenta desconhecida." });
    create
      .mockResolvedValueOnce(wantsTools(toolCall("x", "rm_rf")))
      .mockResolvedValueOnce(text("não consegui"));

    await runChatCompletion({ client, model: "m", messages });

    expect(executeTool).toHaveBeenCalledWith("rm_rf", "{}", "deps");
  });

  it("executa as chamadas de uma rodada em paralelo e responde a cada tool_call_id", async () => {
    const order: string[] = [];
    executeTool.mockImplementation(async (_n: string, args: string) => {
      order.push(`start ${args}`);
      await new Promise((r) => setTimeout(r, 5));
      order.push(`end ${args}`);
      return { ok: args };
    });
    create
      .mockResolvedValueOnce(
        wantsTools(
          toolCall("a", "search_active_items", '{"query":"x"}'),
          toolCall("b", "search_active_items", '{"query":"y"}'),
        ),
      )
      .mockResolvedValueOnce(text("ok"));

    await runChatCompletion({ client, model: "m", messages });

    // As duas começam antes de qualquer uma terminar.
    expect(order.slice(0, 2)).toEqual([
      'start {"query":"x"}',
      'start {"query":"y"}',
    ]);
    const tools = create.mock.calls[1][0].messages.filter(
      (m: { role: string }) => m.role === "tool",
    );
    expect(tools.map((m: { tool_call_id: string }) => m.tool_call_id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("chamadas idênticas na mesma rodada executam uma vez só", async () => {
    create
      .mockResolvedValueOnce(wantsTools(toolCall("a"), toolCall("b")))
      .mockResolvedValueOnce(text("ok"));

    await runChatCompletion({ client, model: "m", messages });

    expect(executeTool).toHaveBeenCalledTimes(1);
    const tools = create.mock.calls[1][0].messages.filter(
      (m: { role: string }) => m.role === "tool",
    );
    expect(tools).toHaveLength(2);
    expect(tools[0].content).toBe(tools[1].content);
  });

  it("devolve null quando o modelo não produz texto", async () => {
    create.mockResolvedValueOnce(text(null));
    expect(
      await runChatCompletion({ client, model: "m", messages }),
    ).toBeNull();
  });

  it("propaga falhas do provedor para a rota tratar", async () => {
    create
      .mockResolvedValueOnce(wantsTools(toolCall("a")))
      .mockRejectedValueOnce(new Error("provider down"));
    await expect(
      runChatCompletion({ client, model: "m", messages }),
    ).rejects.toThrow("provider down");
  });
});
