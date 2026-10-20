import { z } from "zod";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import {
  listExploreItems,
  type ExploreItem,
} from "@/application/use-cases/list-explore-items";
import type { BidStatsList } from "@/domain/repositories/bid-repository";
import type { ExploreLister } from "@/domain/repositories/item-repository";
import { drizzleExploreLister } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleBidStatsList } from "@/infrastructure/database/repositories/drizzle-bid-repository";
import { formatBRL } from "@/lib/format-brl";

// ponytail: tetos rígidos no SERVIDOR. O modelo pode pedir `limit: 500`, mas o
// que chega ao prompt é sempre no máximo MAX_LIMIT itens — o resultado da
// ferramenta volta como tokens pagos e ocupa a janela do modelo.
export const DEFAULT_LIMIT = 5;
export const MAX_LIMIT = 10;
export const MAX_QUERY_LENGTH = 100;

export const SEARCH_ACTIVE_ITEMS = "search_active_items";

const SORTS = ["ending_soon", "most_bids", "highest_bid", "recent"] as const;

// `strict()`: argumento desconhecido é rejeitado em vez de ignorado em silêncio
// — o modelo recebe o erro e corrige a chamada.
const searchActiveItemsArgs = z
  .object({
    query: z.string().trim().max(MAX_QUERY_LENGTH).optional(),
    limit: z.number().int().positive().optional(),
    sort: z.enum(SORTS).optional(),
  })
  .strict();

export type SearchActiveItemsArgs = z.infer<typeof searchActiveItemsArgs>;

/** Campos mínimos devolvidos ao modelo. Sem vendedor, sem ids internos além da referência pública. */
export interface ActiveItemResult {
  ref: string;
  title: string;
  type: string;
  status: "active";
  minInitialBid: string;
  highestBid: string | null;
  totalBids: number;
  bidDeadline: string;
  url: string;
}

export type ToolResult =
  | { items: ActiveItemResult[]; returned: number; totalMatching: number }
  | { error: string };

export interface ToolDeps {
  exploreLister: ExploreLister;
  bidStats: BidStatsList;
}

const defaultDeps: ToolDeps = {
  exploreLister: drizzleExploreLister,
  bidStats: drizzleBidStatsList,
};

/**
 * Deps que lembram o resultado durante UMA requisição do chat. Se o modelo
 * pedir a ferramenta várias vezes (ex.: um item por chamada), a lista de itens
 * ativos e os agregados de lance saem do banco uma vez só, em vez de a cada
 * chamada. Vale só pela vida da requisição, então nunca serve dado velho.
 * Promessas rejeitadas não ficam guardadas: a próxima chamada tenta de novo.
 */
export function createMemoizedDeps(base: ToolDeps = defaultDeps): ToolDeps {
  let rows: ReturnType<ExploreLister["listActiveWithSeller"]> | undefined;
  const stats = new Map<string, ReturnType<BidStatsList["ofManyItems"]>>();

  return {
    exploreLister: {
      listActiveWithSeller() {
        rows ??= base.exploreLister.listActiveWithSeller().catch((err) => {
          rows = undefined;
          throw err;
        });
        return rows;
      },
    },
    bidStats: {
      ofManyItems(ids) {
        const key = [...ids].sort().join(",");
        let hit = stats.get(key);
        if (!hit) {
          hit = base.bidStats.ofManyItems(ids).catch((err) => {
            stats.delete(key);
            throw err;
          });
          stats.set(key, hit);
        }
        return hit;
      },
    },
  };
}

/** Definição enviada ao modelo (formato `tools` da API de chat completions). */
export const chatTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: SEARCH_ACTIVE_ITEMS,
      description:
        "Consulta (somente leitura) os itens com leilão ativo na plataforma: título, lance atual, quantidade de lances e prazo de encerramento. Use para perguntas sobre itens disponíveis, itens com lances, maiores lances ou itens perto de encerrar. UMA chamada basta para vários itens: omita query e use limit maior (até 10) em vez de chamar uma vez por item.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Texto para filtrar pelo título do item. Omita para listar todos.",
            maxLength: MAX_QUERY_LENGTH,
          },
          limit: {
            type: "integer",
            description: `Quantidade máxima de itens (padrão ${DEFAULT_LIMIT}, máximo ${MAX_LIMIT}).`,
            minimum: 1,
            maximum: MAX_LIMIT,
          },
          sort: {
            type: "string",
            enum: [...SORTS],
            description:
              "ending_soon (padrão): prazo mais próximo; most_bids: mais lances; highest_bid: maior lance atual; recent: cadastrados há menos tempo.",
          },
        },
        additionalProperties: false,
      },
    },
  },
];

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const comparators: Record<
  (typeof SORTS)[number],
  (a: ExploreItem, b: ExploreItem) => number
> = {
  ending_soon: (a, b) => a.bidDeadline.getTime() - b.bidDeadline.getTime(),
  most_bids: (a, b) => b.totalBids - a.totalBids,
  highest_bid: (a, b) => (b.highestBid ?? -1) - (a.highestBid ?? -1),
  recent: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
};

function toResult(item: ExploreItem): ActiveItemResult {
  return {
    ref: item.id,
    title: item.title,
    type: item.type,
    status: "active",
    minInitialBid: `R$ ${formatBRL(item.minInitialBid)}`,
    highestBid:
      item.highestBid === null ? null : `R$ ${formatBRL(item.highestBid)}`,
    totalBids: item.totalBids,
    bidDeadline: item.bidDeadline.toISOString(),
    url: `/${item.sellerSlug ?? ""}/${item.id}`,
  };
}

/**
 * Executa `search_active_items`. A definição de "ativo" e de visibilidade vem
 * toda de `listExploreItems` (mesma fonte da página /explore); aqui só se
 * filtra por título, ordena e limita — decisões de apresentação, não regra de
 * negócio.
 */
export async function searchActiveItems(
  rawArgs: unknown,
  deps: ToolDeps = defaultDeps,
): Promise<ToolResult> {
  const parsed = searchActiveItemsArgs.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return { error: "Argumentos inválidos para search_active_items." };
  }
  const { query, sort = "ending_soon" } = parsed.data;
  const limit = Math.min(parsed.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  let items = await listExploreItems(deps.exploreLister, deps.bidStats);

  // Item sem slug de vendedor geraria link quebrado; o INNER JOIN já o exclui,
  // este filtro é só a garantia de tipo (`sellerSlug: string | null`).
  items = items.filter((i) => i.sellerSlug);

  if (query) {
    const needle = normalize(query);
    items = items.filter((i) => normalize(i.title).includes(needle));
  }

  const sorted = [...items].sort(comparators[sort]);
  const page = sorted.slice(0, limit).map(toResult);
  return { items: page, returned: page.length, totalMatching: sorted.length };
}

/**
 * Despacha só ferramentas registradas. Nome desconhecido, JSON malformado e
 * falha na consulta viram um resultado de erro genérico para o modelo — nunca
 * detalhes internos.
 */
export async function executeTool(
  name: string,
  rawArguments: string,
  deps?: ToolDeps,
): Promise<ToolResult> {
  if (name !== SEARCH_ACTIVE_ITEMS) {
    return { error: "Ferramenta desconhecida." };
  }

  let args: unknown;
  try {
    args = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return { error: "Argumentos inválidos para search_active_items." };
  }

  try {
    return await searchActiveItems(args, deps);
  } catch (err) {
    console.error(
      "[api/chat] Falha na ferramenta",
      name,
      err instanceof Error ? err.message : "erro",
    );
    return { error: "Não foi possível consultar os itens agora." };
  }
}
