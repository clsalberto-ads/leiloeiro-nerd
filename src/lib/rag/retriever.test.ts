import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IndexedChunk } from "@/domain/rag/types";

const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile, default: { readFile } }));

// Embeddings "de brinquedo": cada eixo representa um tópico, então a
// similaridade de cosseno entre consulta e chunk fica previsível nos testes,
// sem precisar chamar a OpenAI de verdade.
const { embedText } = vi.hoisted(() => ({ embedText: vi.fn() }));
vi.mock("./embeddings", () => ({ embedText }));

function topicVector(topic: "participar" | "pagamento" | "nenhum"): number[] {
  if (topic === "participar") return [1, 0, 0];
  if (topic === "pagamento") return [0, 1, 0];
  return [0, 0, 1]; // não alinhado com nenhum chunk indexado nestes testes
}

const INDEX: IndexedChunk[] = [
  {
    id: "faq-participacao-001",
    source: "knowledge/faq/participacao.md",
    title: "Como participar",
    content: "Para participar...",
    embedding: [1, 0, 0],
  },
  {
    id: "faq-pagamento-001",
    source: "knowledge/faq/pagamento.md",
    title: "Pagamento",
    content: "O pagamento...",
    embedding: [0, 1, 0],
  },
];

describe("LocalKnowledgeRetriever", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    readFile.mockResolvedValue(JSON.stringify(INDEX));
    const { resetIndexCache } = await import("./retriever");
    resetIndexCache();
  });

  it("retorna o chunk cujo tópico bate com a pergunta, acima do threshold padrão", async () => {
    const { LocalKnowledgeRetriever } = await import("./retriever");
    embedText.mockResolvedValue(topicVector("participar"));

    const results = await new LocalKnowledgeRetriever().search(
      "Como faço para participar?",
    );

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("faq-participacao-001");
    expect(results[0].score).toBeCloseTo(1);
  });

  it("retorna vazio quando nada ultrapassa o threshold (pergunta sem relação com a base)", async () => {
    const { LocalKnowledgeRetriever } = await import("./retriever");
    embedText.mockResolvedValue(topicVector("nenhum"));

    const results = await new LocalKnowledgeRetriever().search(
      "Qual é o lance atual do item 123?",
    );

    expect(results).toEqual([]);
  });

  it("respeita minScore e topK passados em options", async () => {
    const { LocalKnowledgeRetriever } = await import("./retriever");
    embedText.mockResolvedValue([0.9, 0.3, 0]);

    const withDefault = await new LocalKnowledgeRetriever().search("pergunta");
    const withLowThreshold = await new LocalKnowledgeRetriever().search(
      "pergunta",
      {
        minScore: 0,
        topK: 1,
      },
    );

    expect(withDefault.length).toBeLessThanOrEqual(withLowThreshold.length);
    expect(withLowThreshold).toHaveLength(1);
  });

  it("ordena os resultados do mais relevante para o menos relevante", async () => {
    const { LocalKnowledgeRetriever } = await import("./retriever");
    embedText.mockResolvedValue([0.9, 0.3, 0]);

    const results = await new LocalKnowledgeRetriever().search("pergunta", {
      minScore: 0,
    });

    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
  });

  it("lança KnowledgeIndexNotFoundError quando o índice não existe", async () => {
    readFile.mockRejectedValue(new Error("ENOENT"));
    const { KnowledgeIndexNotFoundError, LocalKnowledgeRetriever } =
      await import("./retriever");

    await expect(
      new LocalKnowledgeRetriever().search("qualquer coisa"),
    ).rejects.toBeInstanceOf(KnowledgeIndexNotFoundError);
  });

  it("não vaza o campo embedding para fora do módulo", async () => {
    const { LocalKnowledgeRetriever } = await import("./retriever");
    embedText.mockResolvedValue(topicVector("participar"));

    const [result] = await new LocalKnowledgeRetriever().search("participar");

    expect(result).not.toHaveProperty("embedding");
  });
});
