export type {
  IndexedChunk,
  KnowledgeChunk,
  KnowledgeResult,
  KnowledgeRetriever,
  SearchOptions,
} from "@/domain/rag/types";

export { RAG_CONFIG } from "./config";
export { parseMarkdownSections } from "./markdown";
export type { MarkdownSection, ParsedMarkdown } from "./markdown";
export { chunkMarkdown } from "./chunking";
export { embedText, embedTexts, EMBEDDING_MODEL } from "./embeddings";
export { cosineSimilarity } from "./similarity";
export {
  KnowledgeIndexNotFoundError,
  LocalKnowledgeRetriever,
  resetIndexCache,
} from "./retriever";
export { buildContextBlock, searchKnowledge } from "./search";
