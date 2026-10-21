import type Redis from "ioredis";

// ponytail (R5.2): o rate limit era um Map em MEMÓRIA — com PM2 cluster ou duas
// réplicas, cada processo tinha o PRÓPRIO contador e o limite real dobrava.
// A versão Redis usa INCR + EXPIRE atômicos (o Redis do BullMQ já existe no
// projeto); a in-memory fica como FALLBACK para testes e ambientes sem Redis.
//
// A função é async agora — os dois call sites (chat e webhook) já a esperam.
//
// A janela é FIXA (não deslizante como a in-memory): um request às 23:59:59 e
// outro às 00:00:01 caem em janelas diferentes. Para rate limiting isto é o
// padrão da indústria (é como o NGINX e o Express rate-limit funcionam).

type RateLimitBackend = {
  isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean>;
  reset(): void;
};

// ─── backend in-memory (fallback/testes) ────────────────────────────────────

const memoryHits = new Map<string, number[]>();

const memoryBackend: RateLimitBackend = {
  async isRateLimited(key, limit, windowMs) {
    const now = Date.now();
    const hits = memoryHits.get(key) ?? [];
    const valid = hits.filter((t) => now - t < windowMs);
    if (valid.length >= limit) {
      memoryHits.set(key, valid);
      return true;
    }
    valid.push(now);
    memoryHits.set(key, valid);
    return false;
  },
  reset() {
    memoryHits.clear();
  },
};

// ─── backend Redis (produção) ────────────────────────────────────────────────

// INCR atômico + EXPIRE só no primeiro: janela fixa, sem corrida entre
// réplica A incrementar e réplica B expirar o mesmo segundo.
const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

function redisBackend(client: Redis): RateLimitBackend {
  return {
    async isRateLimited(key, limit, windowMs) {
      const windowSeconds = Math.ceil(windowMs / 1000);
      const count = await client.eval(
        RATE_LIMIT_SCRIPT,
        1,
        `ratelimit:${key}`,
        windowSeconds,
      );
      return Number(count) > limit;
    },
    reset() {
      // noop: o Redis expira sozinho; o reset é para testes, que usam o
      // in-memory
    },
  };
}

// ─── seleção do backend ─────────────────────────────────────────────────────

let backend: RateLimitBackend | null = null;
let backendResolved = false;

async function getBackend(): Promise<RateLimitBackend> {
  if (backendResolved) return backend!;
  backendResolved = true;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      // import lazy: o ioredis só entra no bundle de quem tem Redis
      const { default: RedisClient } = await import("ioredis");
      const client = new RedisClient(redisUrl, { lazyConnect: false, maxRetriesPerRequest: 1 });
      // o ping imediato falha se o Redis não está acessível
      await client.ping();
      backend = redisBackend(client);
      return backend;
    } catch {
      // Redis configurado mas fora do ar: cai para in-memory SEM derrubar
      // ninguém — um rate limit duplicado é melhor que um endpoint morto
      console.warn("[rate-limit] Redis indisponível, usando in-memory (multi-instância pode duplicar o limite)");
    }
  }
  backend = memoryBackend;
  return backend;
}

/**
 * Registra um acesso e devolve `true` quando a chave JÁ EXCEDEU o limite
 * nesta janela (ou seja: deve ser recusada agora).
 */
export async function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const b = await getBackend();
  return b.isRateLimited(key, limit, windowMs);
}

/** Limpa tudo (usado pelos testes — que rodam no backend in-memory). */
export function resetRateLimits(): void {
  memoryBackend.reset();
}
