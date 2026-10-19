import type {
  KnowledgeResult,
  KnowledgeRetriever,
  SearchOptions,
} from "@/domain/rag/types";
import { LocalKnowledgeRetriever } from "./retriever";

const defaultRetriever: KnowledgeRetriever = new LocalKnowledgeRetriever();

/**
 * Busca semântica na base de conhecimento.
 *
 * 1. gera o embedding da pergunta;
 * 2. compara com os embeddings do índice (via `retriever`);
 * 3. devolve só os chunks que passam do `minScore`, ordenados por
 *    relevância, limitados a `topK`.
 *
 * O parâmetro `retriever` é a abstração que permite trocar a implementação
 * (hoje LocalKnowledgeRetriever, no futuro uma baseada em pgvector) sem mudar
 * quem chama searchKnowledge; nos testes, ele também permite injetar um
 * retriever falso sem mockar módulos.
 */
export async function searchKnowledge(
  query: string,
  options?: SearchOptions,
  retriever: KnowledgeRetriever = defaultRetriever,
): Promise<KnowledgeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return retriever.search(trimmed, options);
}

/**
 * Monta o bloco de contexto enviado à IA a partir dos resultados da busca.
 * Retorna `null` quando não há nenhum resultado relevante — nesse caso a IA
 * não deve fingir que encontrou informação (ver `buildSystemPrompt`).
 */
export function buildContextBlock(results: KnowledgeResult[]): string | null {
  if (results.length === 0) return null;

  const blocks = results.map((result) => {
    const lines = [`Fonte: ${result.source}`];
    const sectionLabel = result.section ?? result.title;
    if (sectionLabel) lines.push(`Seção: ${sectionLabel}`);
    lines.push("", result.content.trim());
    return lines.join("\n");
  });

  return `CONTEXTO DA BASE DE CONHECIMENTO\n\n${blocks.join("\n\n---\n\n")}`;
}
