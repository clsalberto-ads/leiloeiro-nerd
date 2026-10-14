import { describe, expect, it } from "vitest";
import { chunkMarkdown } from "./chunking";

const PARTICIPACAO_MD = `# Como participar de um leilão

Para participar de um leilão, o usuário deve possuir uma conta
na plataforma e realizar o cadastro solicitado.

## Cadastro

O usuário deverá fornecer seus dados pessoais e documentos
necessários para validação.

## Habilitação

Após o cadastro, o usuário deverá estar habilitado para participar
do leilão desejado.

## Lances

Após estar habilitado, o usuário poderá realizar lances nos itens
disponíveis.
`;

describe("chunkMarkdown", () => {
  it("divide o documento em um chunk por seção, preservando a estrutura", () => {
    const chunks = chunkMarkdown(
      "knowledge/faq/participacao.md",
      PARTICIPACAO_MD,
    );

    expect(chunks).toHaveLength(4);
    expect(chunks.map((c) => c.section)).toEqual([
      undefined, // título do documento, não é uma subseção
      "Cadastro",
      "Habilitação",
      "Lances",
    ]);
    expect(
      chunks.every((c) => c.title === "Como participar de um leilão"),
    ).toBe(true);
    expect(
      chunks.every((c) => c.source === "knowledge/faq/participacao.md"),
    ).toBe(true);
  });

  it("gera ids estáveis e únicos a partir do caminho do arquivo", () => {
    const chunks = chunkMarkdown(
      "knowledge/faq/participacao.md",
      PARTICIPACAO_MD,
    );

    expect(chunks.map((c) => c.id)).toEqual([
      "faq-participacao-001",
      "faq-participacao-002",
      "faq-participacao-003",
      "faq-participacao-004",
    ]);
  });

  it("inclui o texto do cabeçalho dentro do conteúdo do chunk", () => {
    const [, cadastro] = chunkMarkdown(
      "knowledge/faq/participacao.md",
      PARTICIPACAO_MD,
    );

    expect(cadastro.content).toContain("Cadastro");
    expect(cadastro.content).toContain("dados pessoais e documentos");
  });

  it("não quebra uma seção curta em múltiplos chunks", () => {
    const md = "# Título\n\nUm parágrafo curto.\n";
    expect(chunkMarkdown("knowledge/x.md", md)).toHaveLength(1);
  });

  it("divide uma seção muito longa em vários chunks, sem cortar parágrafos ao meio", () => {
    const paragraphs = Array.from({ length: 10 }, (_, i) =>
      `Parágrafo número ${i} com bastante texto para simular conteúdo real extenso.`.repeat(
        5,
      ),
    );
    const md = `# Título\n\n## Seção longa\n\n${paragraphs.join("\n\n")}\n`;

    const chunks = chunkMarkdown("knowledge/longo.md", md);
    const sectionChunks = chunks.filter((c) => c.section === "Seção longa");

    expect(sectionChunks.length).toBeGreaterThan(1);
    for (const chunk of sectionChunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(
        1200 + "## Seção longa\n\n".length,
      );
    }
    for (const paragraph of paragraphs) {
      expect(sectionChunks.some((c) => c.content.includes(paragraph))).toBe(
        true,
      );
    }
  });

  it("ignora arquivos vazios", () => {
    expect(chunkMarkdown("knowledge/vazio.md", "")).toEqual([]);
    expect(chunkMarkdown("knowledge/so-espacos.md", "   \n\n   ")).toEqual([]);
  });

  it("lida com conteúdo antes do primeiro cabeçalho", () => {
    const md =
      "Texto introdutório sem cabeçalho.\n\n# Título\n\nResto do texto.\n";
    const chunks = chunkMarkdown("knowledge/intro.md", md);

    expect(chunks[0].content).toBe("Texto introdutório sem cabeçalho.");
    expect(chunks[0].title).toBe("Título");
  });
});
