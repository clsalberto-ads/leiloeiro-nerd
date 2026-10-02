import { desc, eq, inArray, max, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { bids, items } from "@/infrastructure/database/schema";
import type {
  Bid,
  BidRepository,
  CreateBidInput,
  BidStats,
  BidStatsList,
} from "@/domain/repositories/bid-repository";

export function nextRank(highestRank: number | null): number {
  return (highestRank ?? 0) + 1;
}

export const drizzleBidRepository: BidRepository = {
  async findByItemId(itemId) {
    const rows = await db
      .select({
        id: bids.id,
        itemId: bids.itemId,
        bidderId: bids.bidderId,
        amount: bids.amount,
        rank: bids.rank,
        createdAt: bids.createdAt,
      })
      .from(bids)
      .where(eq(bids.itemId, itemId))
      .orderBy(desc(bids.amount));
    return rows.map((r) => ({ ...r, bidderName: r.bidderId }));
  },

  async placeBid(input: CreateBidInput, validate) {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM ${items} WHERE id = ${input.itemId} FOR UPDATE`);

      const [itemRow] = await tx
        .select({
          id: items.id,
          title: items.title,
          sellerId: items.sellerId,
          status: items.status,
          bidDeadline: items.bidDeadline,
          minInitialBid: items.minInitialBid,
          minBidIncrement: items.minBidIncrement,
        })
        .from(items)
        .where(eq(items.id, input.itemId));

      const [highestRow] = await tx
        .select({
          id: bids.id,
          bidderId: bids.bidderId,
          amount: bids.amount,
          rank: bids.rank,
          createdAt: bids.createdAt,
        })
        .from(bids)
        .where(eq(bids.itemId, input.itemId))
        .orderBy(desc(bids.amount))
        .limit(1);

      const highestBid: Bid | undefined = highestRow
        ? { ...highestRow, itemId: input.itemId, bidderName: highestRow.bidderId }
        : undefined;

      validate({
        item: itemRow
          ? {
              id: itemRow.id,
              title: itemRow.title,
              sellerId: itemRow.sellerId,
              status: itemRow.status,
              bidDeadline: itemRow.bidDeadline,
              minInitialBid: itemRow.minInitialBid,
              minBidIncrement: itemRow.minBidIncrement,
            }
          : null,
        highestBid,
      });

      const rank = nextRank(highestRow?.rank ?? null);

      const [row] = await tx
        .insert(bids)
        .values({ ...input, rank })
        .returning();

      return {
        bid: {
          id: row.id,
          itemId: row.itemId,
          bidderId: row.bidderId,
          bidderName: row.bidderId,
          amount: row.amount,
          rank: row.rank,
          createdAt: row.createdAt,
        } satisfies Bid,
        previousHighestBid: highestBid ?? null,
      };
    });
  },
};

// ponytail: `total: number | string` e o que torna o `Number()` LOAD-BEARING.
// `count(*)` volta `bigint` do Postgres e o `pg` entrega `bigint`/`numeric` como
// TEXTO (o mesmo que o `drizzle-analytics-repository.ts` trata com
// `Number(ativos[0]?.soma ?? 0)`). Com o parametro tipado `number`, a coercia
// ficava INVISIVEL para o compilador: `sql<number>` afirma ao `tsc` que ja e
// numero, entao apagar o `Number()` nao dava erro de tipo — e um `highestBid`
// string viraria `NaN` silencioso na posicao de ordenacao, sem teste vermelho.
// Tipando a fronteira como `number | string`, remover a coercia passa a ser erro
// de compilacao, e o unico `Number` defensivo do arquivo e o que sobrevive.
//
// ponytail: `maior` continua `number | null` e NAO foi alargado, porque `max()`
// de `integer` volta inteiro de verdade — o `Number` no corpo dele e o par do
// `total`, e nao ha evidencia de que ele algum dia venha texto.
export function toStats(
  linhas: { itemId: string; total: number | string; maior: number | null }[],
): Map<string, BidStats> {
  const mapa = new Map<string, BidStats>();
  for (const row of linhas) {
    mapa.set(row.itemId, { total: Number(row.total), maior: row.maior === null ? null : Number(row.maior) });
  }
  return mapa;
}

// ponytail: uma query, e nao uma por item. O indice `(item_id, amount DESC)`
// (migracao 0004) faz isto ser INDEX-ONLY: o `GROUP BY item_id` e o `max(amount)`
// leem as duas colunas do indice, sem tocar no heap. Num banco de 9 linhas o
// planner escolhe seq scan, e esta certo — a prova de que o indice e usavel vem
// de um `explain` com `SET enable_seqscan = off`, onde o plano mostra
// `Index Only Scan using bids_item_id_amount_idx`. E o `inArray` com a lista de
// ids, e nao a tabela de lances inteira, que mantem o plano em index scan.
export const drizzleBidStatsList: BidStatsList = {
  async ofManyItems(itemIds) {
    if (itemIds.length === 0) return new Map();
    const linhas = await db
      .select({
        itemId: bids.itemId,
        total: sql<number>`count(*)::int`,
        maior: max(bids.amount),
      })
      .from(bids)
      .where(inArray(bids.itemId, itemIds))
      .groupBy(bids.itemId);
    return toStats(linhas);
  },
};