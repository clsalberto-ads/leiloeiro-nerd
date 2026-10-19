import { describe, expect, it, vi } from "vitest";
import type {
  KnowledgeResult,
  KnowledgeRetriever,
  SearchOptions,
} from "@/domain/rag/types";
import { buildContextBlock, searchKnowledge } from "./search";

function fakeRetriever(results: KnowledgeResult[]): KnowledgeRetriever {
  return { search: vi.fn().mockResolvedValue(results) };
}

const PARTICIPACAO: KnowledgeResult = {
  id: "faq-participacao-002",
  source: "knowledge/faq/participacao.md",
  title: "Como participar",
  section: "Cadastro",
  content:
    "O usuário deverá fornecer seus dados pessoais e documentos necessários.",
  score: 0.91,
};

const LANCES: KnowledgeResult = {
  id: "faq-lances-002",
  source: "knowledge/faq/lances.md",
  title: "Como dar um lance",
  section: "Notificação de lance superado",
  content: "A plataforma envia uma notificação quando o lance é superado.",
  score: 0.74,
};

describe("searchKnowledge", () => {
  it("delega para o retriever informado, já com a pergunta sem espaços nas pontas", async () => {
    const retriever = fakeRetriever([PARTICIPACAO]);

    const results = await searchKnowledge(
      "  Como faço para participar?  ",
      undefined,
      retriever,
    );

    expect(retriever.search).toHaveBeenCalledWith(
      "Como faço para participar?",
      undefined,
    );
    expect(results).toEqual([PARTICIPACAO]);
  });

  it("repassa as options (topK, minScore) para o retriever", async () => {
    const retriever = fakeRetriever([]);
    const options: SearchOptions = { topK: 3, minScore: 0.8 };

    await searchKnowledge("pergunta", options, retriever);

    expect(retriever.search).toHaveBeenCalledWith("pergunta", options);
  });

  it("retorna vazio sem chamar o retriever para uma pergunta vazia", async () => {
    const retriever = fakeRetriever([PARTICIPACAO]);

    const results = await searchKnowledge("   ", undefined, retriever);

    expect(results).toEqual([]);
    expect(retriever.search).not.toHaveBeenCalled();
  });
});

describe("buildContextBlock", () => {
  it("retorna null quando não há resultados", () => {
    expect(buildContextBlock([])).toBeNull();
  });

  it("formata um único resultado com fonte e seção", () => {
    const block = buildContextBlock([PARTICIPACAO]);

    expect(block).toContain("CONTEXTO DA BASE DE CONHECIMENTO");
    expect(block).toContain("Fonte: knowledge/faq/participacao.md");
    expect(block).toContain("Seção: Cadastro");
    expect(block).toContain("O usuário deverá fornecer");
  });

  it("usa o título como seção quando o chunk não tem section (ex.: chunk do título)", () => {
    const block = buildContextBlock([{ ...PARTICIPACAO, section: undefined }]);
    expect(block).toContain("Seção: Como participar");
  });

  it("separa múltiplos resultados com '---'", () => {
    const block = buildContextBlock([PARTICIPACAO, LANCES]);

    expect(block).toContain("knowledge/faq/participacao.md");
    expect(block).toContain("knowledge/faq/lances.md");
    expect(block?.split("\n\n---\n\n")).toHaveLength(2);
  });
});
