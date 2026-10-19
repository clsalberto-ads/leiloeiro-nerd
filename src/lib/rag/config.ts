function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Configuração do RAG, sobrescrevível por variáveis de ambiente. */
export const RAG_CONFIG = {
  /** Quantos chunks, no máximo, a busca retorna. */
  topK: envNumber("RAG_TOP_K", 5),
  /** Similaridade mínima (cosseno, 0 a 1) para um chunk ser considerado relevante. */
  minScore: envNumber("RAG_MIN_SCORE", 0.7),
  /** Pasta com os arquivos Markdown de origem, relativa à raiz do projeto. */
  knowledgeDir: process.env.RAG_KNOWLEDGE_DIR ?? "knowledge",
  /** Caminho do índice gerado pela indexação, relativo à raiz do projeto. */
  indexPath: process.env.RAG_INDEX_PATH ?? "data/knowledge-index.json",
} as const;
