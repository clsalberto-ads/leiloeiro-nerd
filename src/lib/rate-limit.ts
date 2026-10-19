/**
 * Rate limit em memória por chave (janela deslizante).
 *
 * O /api/chat é um endpoint PÚBLICO que dispara chamadas a APIs pagas
 * (embeddings + LLM). Sem nenhum limite, um script simples quebra a cota
 * do projeto em minutos. Este limitador não substitui um rate limit de
 * infraestrutura (Vercel/NGINX/Cloudflare) nem um armazenamento distribuído
 * (Redis) — é a barata e local: por processo, suficiente para o tráfego atual
 * e para não deixar a porta escancarada.
 *
 * `Map` global por instância do servidor: em serverless com múltiplas
 * lambdas cada uma tem o próprio mapa (o limite vale por instância), e um
 * reinício zera a janela — limitação aceitável e documentada aqui de
 * propósito, para quem for trocar por Redis saber o que está trocando.
 */

interface WindowState {
  hits: number[];
}

const windows = new Map<string, WindowState>();

/**
 * Registra um acesso e devolve `true` quando a chave JÁ EXCEDEU o limite
 * nesta janela (ou seja: deve ser recusada agora).
 *
 * Janela deslizante de verdade, e não fixa por minuto: um acesso às 23:59:59
 * e outro às 00:00:01 não "zeram" o contador por virada de minuto.
 */
export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const state = windows.get(key) ?? { hits: [] };

  state.hits = state.hits.filter((t) => now - t < windowMs);

  if (state.hits.length >= limit) {
    // Não registra o golpe recusado: a janela desliza sobre os ACEITOS.
    windows.set(key, state);
    return true;
  }

  state.hits.push(now);
  windows.set(key, state);
  return false;
}

/** Limpa tudo (usado pelos testes). */
export function resetRateLimits(): void {
  windows.clear();
}
