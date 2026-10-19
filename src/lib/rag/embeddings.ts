import { EMBEDDING_MODEL, getOpenAIEmbeddingsClient } from "./openai-client";

export { EMBEDDING_MODEL };

/** Erro "requisição inválida" (HTTP 400) devolvido pela API de embeddings. */
function isBadRequest(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { status?: unknown }).status === 400
  );
}

/** Um request por texto: mais lento, mas não depende de o provedor aceitar `input` em lote. */
async function embedOneByOne(texts: string[]): Promise<number[][]> {
  const client = getOpenAIEmbeddingsClient();
  const embeddings: number[][] = [];

  for (const text of texts) {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });
    const item = response.data[0];
    if (!item)
      throw new Error("A API de embeddings não retornou nenhum vetor.");
    embeddings.push(item.embedding);
  }

  return embeddings;
}

/**
 * Único ponto de chamada à API de embeddings. Tanto o script de indexação
 * quanto a busca semântica passam por aqui, para não espalhar chamadas à API
 * pelo código.
 *
 * Tenta um request em lote (`input` como array). Provedores que implementam a
 * API da OpenAI só parcialmente (como a camada de compatibilidade do Gemini,
 * que não documenta `input` em lote) podem recusar o lote (HTTP 400) ou
 * devolver menos vetores que textos; nesses casos caímos para um request por
 * texto. Outros erros (401 chave inválida, 429 limite/créditos) sobem como
 * estão — repetir um request por texto não os resolveria.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  try {
    const response = await getOpenAIEmbeddingsClient().embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });

    // A API normalmente devolve na mesma ordem da entrada, mas reordenamos
    // por `index` para não depender dessa garantia.
    const embeddings = [...response.data]
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    // Sem esta checagem, um lote "aceito pela metade" geraria um índice com
    // vetores `undefined` e a busca quebraria só depois, em outro lugar.
    if (embeddings.length === texts.length) return embeddings;
  } catch (err) {
    if (!isBadRequest(err)) throw err;
  }

  return embedOneByOne(texts);
}

/** Atalho para gerar o embedding de um único texto (ex.: a pergunta do usuário). */
export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
