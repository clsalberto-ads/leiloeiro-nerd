import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  IndexedChunk,
  KnowledgeResult,
  KnowledgeRetriever,
  SearchOptions,
} from "@/domain/rag/types";
import { RAG_CONFIG } from "./config";
import { embedText } from "./embeddings";
import { cosineSimilarity } from "./similarity";

export class KnowledgeIndexNotFoundError extends Error {
  constructor(path: string) {
    super(
      `Índice de conhecimento não encontrado em "${path}". Execute "pnpm knowledge:index" para gerá-lo.`,
    );
    this.name = "KnowledgeIndexNotFoundError";
  }
}

let cachedIndex: IndexedChunk[] | null = null;

async function loadIndex(): Promise<IndexedChunk[]> {
  if (cachedIndex) return cachedIndex;

  const path = resolve(process.cwd(), RAG_CONFIG.indexPath);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new KnowledgeIndexNotFoundError(RAG_CONFIG.indexPath);
  }

  cachedIndex = JSON.parse(raw) as IndexedChunk[];
  return cachedIndex;
}

/**
 * Limpa o índice em memória. Usado nos testes e após uma reindexação feita
 * pelo mesmo processo (num servidor Next.js de produção, uma reindexação
 * externa só é percebida depois do próximo reinício, já que o índice é lido
 * uma vez e mantido em memória).
 */
export function resetIndexCache(): void {
  cachedIndex = null;
}

/**
 * Implementação de KnowledgeRetriever que lê o índice de um arquivo JSON
 * local e faz a busca por similaridade de cosseno em memória. Pensada para
 * ser substituída por uma PgVectorKnowledgeRetriever (consultando a mesma
 * base Postgres já usada pelo resto da plataforma) sem quem chama
 * searchKnowledge precisar mudar — ver a interface KnowledgeRetriever.
 */
export class LocalKnowledgeRetriever implements KnowledgeRetriever {
  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<KnowledgeResult[]> {
    const topK = options?.topK ?? RAG_CONFIG.topK;
    const minScore = options?.minScore ?? RAG_CONFIG.minScore;

    const index = await loadIndex();
    if (index.length === 0) return [];

    const queryEmbedding = await embedText(query);

    return index
      .map(({ embedding, ...chunk }) => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, embedding),
      }))
      .filter((result) => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
