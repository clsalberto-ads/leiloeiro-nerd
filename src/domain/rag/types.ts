/** Um trecho de conhecimento extraído de um arquivo Markdown, antes de ganhar embedding. */
export interface KnowledgeChunk {
  id: string;
  content: string;
  source: string;
  title?: string;
  section?: string;
}

/** Um chunk já indexado, com seu vetor de embedding. É o que fica salvo em disco. */
export interface IndexedChunk extends KnowledgeChunk {
  embedding: number[];
}

/** Um chunk retornado por uma busca, com a pontuação de similaridade da consulta. */
export interface KnowledgeResult extends KnowledgeChunk {
  score: number;
}

export interface SearchOptions {
  /** Quantidade máxima de resultados retornados. Padrão: RAG_CONFIG.topK. */
  topK?: number;
  /** Similaridade mínima (0 a 1) para um resultado ser considerado relevante. Padrão: RAG_CONFIG.minScore. */
  minScore?: number;
}

/**
 * Abstração da camada de recuperação de conhecimento.
 * A implementação atual (LocalKnowledgeRetriever) lê um índice JSON local;
 * uma futura PgVectorKnowledgeRetriever poderá implementar a mesma interface
 * sem exigir mudanças em quem chama searchKnowledge.
 */
export interface KnowledgeRetriever {
  search(query: string, options?: SearchOptions): Promise<KnowledgeResult[]>;
}
