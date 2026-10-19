import type { KnowledgeChunk } from "@/domain/rag/types";
import { parseMarkdownSections } from "./markdown";

/**
 * Tamanho máximo (em caracteres) do texto de um chunk antes de ser dividido.
 * Mantém os chunks pequenos o bastante para uma busca precisa e um contexto
 * enxuto, sem depender de contagem bruta de caracteres para a divisão —
 * isso só entra em ação dentro de uma seção já identificada pelo Markdown.
 */
const MAX_CHUNK_CHARS = 1200;

/** Converte um caminho de arquivo em um prefixo de id legível e estável. */
function slugify(source: string): string {
  return source
    .replace(/\.mdx?$/i, "")
    .replace(/^knowledge\//, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Divide um texto longo em pedaços por parágrafo, sem romper um parágrafo ao meio. */
function splitLongText(text: string, maxChars: number): string[] {
  if (!text) return [];
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n{2,}/);
  const pieces: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars && current) {
      pieces.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current) pieces.push(current);

  return pieces;
}

/**
 * Divide o Markdown de um arquivo em chunks, preservando título, seção e
 * parágrafos relacionados. Cada cabeçalho (de qualquer nível) vira a base
 * de um chunk; seções muito longas são subdivididas por parágrafo.
 */
export function chunkMarkdown(source: string, raw: string): KnowledgeChunk[] {
  const { title, sections } = parseMarkdownSections(raw);
  const slug = slugify(source);
  const chunks: KnowledgeChunk[] = [];
  let counter = 0;

  for (const section of sections) {
    const isTitleSection = section.level === 1 && section.heading === title;
    const pieces = splitLongText(section.content, MAX_CHUNK_CHARS);

    // Uma seção só com cabeçalho (sem corpo) ainda vira um chunk, para não perder o título.
    const effectivePieces = pieces.length > 0 ? pieces : [""];

    for (const piece of effectivePieces) {
      const content = [section.heading, piece]
        .filter(Boolean)
        .join("\n\n")
        .trim();
      if (!content) continue;

      counter += 1;
      chunks.push({
        id: `${slug}-${String(counter).padStart(3, "0")}`,
        content,
        source,
        title,
        section: isTitleSection ? undefined : (section.heading ?? undefined),
      });
    }
  }

  return chunks;
}
