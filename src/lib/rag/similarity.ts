/**
 * Similaridade de cosseno entre dois vetores de mesma dimensão.
 * Não depende da OpenAI nem de nenhum provedor de embeddings — opera só em
 * números, o que a mantém testável isoladamente e reutilizável com qualquer
 * fonte de vetores.
 *
 * Retorna um valor entre -1 e 1
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vetores de tamanhos diferentes: ${a.length} e ${b.length}.`,
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
