import { loadEnv } from "./load-env";

// Precisa rodar antes de qualquer import que leia a chave de embeddings.
loadEnv();

import { RAG_CONFIG } from "../src/lib/rag/config";
import { LocalKnowledgeRetriever } from "../src/lib/rag/retriever";

/**
 * Mostra o ranking completo de similaridade para uma pergunta, SEM aplicar o
 * threshold. Serve para calibrar RAG_MIN_SCORE: cada provedor de embeddings
 * tem uma escala de similaridade própria (o 0.7 pensado para a OpenAI pode
 * ser alto ou baixo demais para o Gemini).
 */
async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error('Uso: pnpm knowledge:search "sua pergunta"');
    process.exitCode = 1;
    return;
  }

  const results = await new LocalKnowledgeRetriever().search(query, {
    topK: 10,
    minScore: -1,
  });

  console.log(`Pergunta: ${query}`);
  console.log(`Threshold atual (RAG_MIN_SCORE): ${RAG_CONFIG.minScore}\n`);

  for (const result of results) {
    const passa = result.score >= RAG_CONFIG.minScore ? "✔" : " ";
    const secao = result.section ?? result.title ?? "";
    console.log(
      `${passa} ${result.score.toFixed(3)}  ${result.source}  ${secao}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
