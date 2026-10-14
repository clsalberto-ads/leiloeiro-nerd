import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { chunkMarkdown } from "../src/lib/rag/chunking";
import { RAG_CONFIG } from "../src/lib/rag/config";
import { embedTexts } from "../src/lib/rag/embeddings";
import type { IndexedChunk, KnowledgeChunk } from "../src/domain/rag/types";

/** Quantos textos são enviados por chamada à API de embeddings. */
const EMBEDDING_BATCH_SIZE = 100;

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(full)));
    } else if (extname(entry.name).toLowerCase() === ".md") {
      files.push(full);
    }
  }

  return files.sort();
}

async function embedInBatches(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    embeddings.push(...(await embedTexts(batch)));
  }
  return embeddings;
}

async function main() {
  const knowledgeDir = resolve(process.cwd(), RAG_CONFIG.knowledgeDir);
  const indexPath = resolve(process.cwd(), RAG_CONFIG.indexPath);

  console.log(`Procurando arquivos .md em "${RAG_CONFIG.knowledgeDir}"...\n`);
  const files = await listMarkdownFiles(knowledgeDir);

  if (files.length === 0) {
    console.warn(
      `Nenhum arquivo .md encontrado em "${RAG_CONFIG.knowledgeDir}". Nada para indexar.`,
    );
    return;
  }

  const allChunks: KnowledgeChunk[] = [];
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const source = relative(process.cwd(), file).split(sep).join("/");
    const chunks = chunkMarkdown(source, raw);
    allChunks.push(...chunks);
    console.log(`  ${source} → ${chunks.length} chunk(s)`);
  }

  if (allChunks.length === 0) {
    console.warn(
      "\nNenhum chunk foi gerado a partir dos arquivos encontrados. Índice não criado.",
    );
    return;
  }

  console.log(`\nGerando embeddings para ${allChunks.length} chunk(s)...`);
  const embeddings = await embedInBatches(
    allChunks.map((chunk) => chunk.content),
  );

  const indexed: IndexedChunk[] = allChunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings[i],
  }));

  await mkdir(resolve(indexPath, ".."), { recursive: true });
  await writeFile(indexPath, JSON.stringify(indexed, null, 2), "utf8");

  console.log(
    `\n✔ Índice salvo em "${RAG_CONFIG.indexPath}" com ${indexed.length} chunk(s) de ${files.length} arquivo(s).`,
  );
}

main().catch((err) => {
  console.error("\n✘ Falha ao indexar a base de conhecimento:\n");
  console.error(err);
  process.exitCode = 1;
});
