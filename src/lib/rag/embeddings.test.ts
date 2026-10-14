import { beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("./openai-client", () => ({
  EMBEDDING_MODEL: "modelo-de-teste",
  getOpenAIEmbeddingsClient: () => ({ embeddings: { create } }),
}));

import { embedText, embedTexts } from "./embeddings";

function apiError(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

describe("embedTexts", () => {
  beforeEach(() => {
    // Sem setupFiles global neste projeto: reset explícito (calls + implementações).
    create.mockReset();
  });

  it("devolve [] sem chamar a API quando não há textos", async () => {
    expect(await embedTexts([])).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it("faz um único request em lote e reordena os vetores pelo index", async () => {
    create.mockResolvedValue({
      data: [
        { index: 1, embedding: [2, 2] },
        { index: 0, embedding: [1, 1] },
      ],
    });

    const result = await embedTexts(["a", "b"]);

    expect(result).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      model: "modelo-de-teste",
      input: ["a", "b"],
    });
  });

  it("cai para um request por texto quando o lote devolve menos vetores que textos", async () => {
    create
      .mockResolvedValueOnce({ data: [{ index: 0, embedding: [9, 9] }] }) // lote "aceito pela metade"
      .mockResolvedValueOnce({ data: [{ index: 0, embedding: [1, 1] }] })
      .mockResolvedValueOnce({ data: [{ index: 0, embedding: [2, 2] }] });

    const result = await embedTexts(["a", "b"]);

    expect(result).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(create).toHaveBeenCalledTimes(3);
    expect(create).toHaveBeenNthCalledWith(2, {
      model: "modelo-de-teste",
      input: "a",
    });
    expect(create).toHaveBeenNthCalledWith(3, {
      model: "modelo-de-teste",
      input: "b",
    });
  });

  it("cai para um request por texto quando o provedor recusa o lote com HTTP 400", async () => {
    create
      .mockRejectedValueOnce(apiError(400))
      .mockResolvedValueOnce({ data: [{ index: 0, embedding: [1, 1] }] })
      .mockResolvedValueOnce({ data: [{ index: 0, embedding: [2, 2] }] });

    expect(await embedTexts(["a", "b"])).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });

  it.each([401, 429, 500])(
    "não tenta o fallback e propaga o erro HTTP %i",
    async (status) => {
      create.mockRejectedValue(apiError(status));

      await expect(embedTexts(["a", "b"])).rejects.toMatchObject({ status });
      expect(create).toHaveBeenCalledTimes(1);
    },
  );

  it("lança erro claro se o fallback não receber nenhum vetor", async () => {
    create
      .mockRejectedValueOnce(apiError(400))
      .mockResolvedValueOnce({ data: [] });

    await expect(embedTexts(["a"])).rejects.toThrow("nenhum vetor");
  });
});

describe("embedText", () => {
  beforeEach(() => create.mockReset());

  it("devolve o vetor do único texto", async () => {
    create.mockResolvedValue({ data: [{ index: 0, embedding: [3, 4] }] });

    expect(await embedText("pergunta")).toEqual([3, 4]);
  });
});
