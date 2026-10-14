/** Uma seção do documento: tudo o que vem depois de um cabeçalho, até o próximo. */
export interface MarkdownSection {
  /** Texto do cabeçalho (sem os `#`). `null` para conteúdo antes do primeiro cabeçalho. */
  heading: string | null;
  /** Nível do cabeçalho (1 a 6). `0` quando `heading` é `null`. */
  level: number;
  /** Conteúdo da seção, sem o próprio cabeçalho. */
  content: string;
}

export interface ParsedMarkdown {
  /** Título do documento: o texto do primeiro cabeçalho de nível 1, se houver. */
  title?: string;
  sections: MarkdownSection[];
}

const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*$/;

/**
 * Divide um Markdown em seções por cabeçalho (de qualquer nível).
 * Cada cabeçalho inicia uma nova seção que vai até o próximo cabeçalho,
 * preservando a estrutura de título/subtítulo em vez de cortar por contagem
 * de caracteres.
 */
export function parseMarkdownSections(raw: string): ParsedMarkdown {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  const sections: MarkdownSection[] = [];
  let heading: string | null = null;
  let level = 0;
  let buffer: string[] = [];

  function flush() {
    const content = buffer.join("\n").trim();
    if (heading !== null || content) {
      sections.push({ heading, level, content });
    }
    buffer = [];
  }

  for (const line of lines) {
    const match = HEADING_PATTERN.exec(line);
    if (match) {
      flush();
      level = match[1].length;
      heading = match[2].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  const title =
    sections.find((section) => section.level === 1)?.heading ?? undefined;

  return { title, sections };
}
