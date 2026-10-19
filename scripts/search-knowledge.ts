import { RAG_CONFIG } from "../src/lib/rag/config";
import { loadEnv } from "../src/lib/rag/load-env";
import { LocalKnowledgeRetriever } from "../src/lib/rag/retriever";

// Sem isto, "pnpm knowledge:search" só via as variáveis exportadas no shell:
// o tsx não carrega .env sozinho (o script de INDEXAÇÃO ganha o --env-file do
// package.json; este aqui não tinha) e a busca falhava com
// "OPENAI_GEMINI_API_KEY não configurada." num ambiente com .env válido.
loadEnv();

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
