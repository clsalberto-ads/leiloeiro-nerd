import { and, count, desc, eq, max, sql, sum } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { APP_TIMEZONE, localDateOf, startOfLocalDay } from "@/lib/timezone";
import { bids, items } from "@/infrastructure/database/schema";
import { user as userTable } from "@/infrastructure/database/auth-schema";
import type { ItemStatus, ItemType } from "@/domain/repositories/item-repository";
import type {
  AnalyticsRepository,
  ContestedItem,
  RecentBid,
  DailyPoint,
  BuyerSummary,
  SellerSummary,
  SellerSeries,
} from "@/domain/repositories/analytics-repository";

// ponytail: FUSO. Todo dia aqui e um dia em `America/Sao_Paulo`, agrupado no SQL
// e nao no JavaScript, por dois motivos que so o SQL resolve:
//
//   1. O agrupamento tem de acontecer ANTES de a linha chegar no Node: agrupar em
//      JS traria uma linha por lance, e o filtro de "ultimos N dias" usaria o
//      fuso do SERVIDOR (UTC no container).
//   2. `AT TIME ZONE` converte o `timestamptz` para `timestamp` SEM fuso antes do
//      `date_trunc`, que e exatamente o que "dia local" significa. Sem ele, um
//      lance de 22h de sexta viraria sabado.
//
// `sql.raw` e nao `${FUSO}` de prop: o `'...'` entre aspas e o que o Postgres
// espera em `AT TIME ZONE`, e `FUSO` e uma constante de compilacao (nada do
// usuario entra), entao inlinar por `sql.raw` e seguro e evita o parametro tipado
// do driver.
//
// O ponto de usar a CONSTANTE e nao a string: a mesma `America/Sao_Paulo` ja e
// lida pela celula de prazo da tabela de itens (`columns.tsx`), via
// `@/lib/fuso`. Se os dois divergirem, o grafico de "lances por dia" contaria
// dias diferentes dos que a lista de itens mostra — e nada accuse isso, porque
// os dois continuam "funcionando".
const LOCAL_DAY = sql`date_trunc('day', ${bids.createdAt} at time zone ${sql.raw(`'${APP_TIMEZONE}'`)})`;
const LOCAL_DAY_OF_ITEM = sql`date_trunc('day', ${items.createdAt} at time zone ${sql.raw(`'${APP_TIMEZONE}'`)})`;

/** O maior lance de qualquer pessoa no item do lance `alias`. */
const HIGHEST_ON_ITEM = sql`(select max(b2.amount) from ${bids} b2 where b2.item_id = ${bids.itemId})`;

/**
 * Preenche os dias sem nenhuma Bid com zero.
 *
 * ponytail: o `GROUP BY` devolve SO os dias que tiveram lances. Numa janela de
 * 30 dias para um vendedor novo viriam duas ou tres linhas — e o grafico
 * desenharia uma reta com dois pontos em 30 posicoes, que e pior que um
 * grafico vazio porque parece estar errado. O preenchimento fica AQUI, e nao no
 * componente, para servidor e cliente concordarem sobre quantos pontos a linha
 * tem: se o componente preenchesse, o mesmo `dias` produziria um eixo com outra
 * cardinalidade e o `key` do Recharts passaria a mudar entre o SSR e o cliente.
 */
function fillDays(rows: { day: string; total: number }[], days: number, until: Date): DailyPoint[] {
  const map = new Map(rows.map((r) => [r.day, r.total]));
  const output: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    // ponytail: a CHAVE do dia vem de `localDateOf`, e nao de `toISOString().slice`.
    // A janela e uma lista de dias do fuso do produto, e ela tem de casar com as
    // chaves que o SQL agrupa (`date_trunc` em `at time zone FUSO`). Entre 18h e
    // 21h BRT, `toISOString()` devolve a data de amanha e o ultimo ponto do
    // grafico saia rotulado com o dia errado.
    const day = localDateOf(startOfLocalDay(i, until));
    output.push({ day, total: map.get(day) ?? 0 });
  }
  return output;
}

// ponytail: `startOfLocalDay` e nao `setUTCHours(0,0,0,0)`. O limite inferior do
// `WHERE` e um instante, e ele tem de ser a MEIA-NOITE do fuso do produto: em UTC
// a janela de 30 dias comecava as 21:00 de BRT do dia anterior, e o lance das
// 00h30 do primeiro dia ficava fora do grafico. Este e o mesmo par que o
// `datetime-local` usa, entao o grafico e o formulario concordam sobre o dia.
function windowStart(days: number): Date {
  return startOfLocalDay(days - 1);
}

/**
 * `date_trunc` devolve `timestamp sem fuso`; o `pg` o entrega como `Date`
 * interpretado no fuso do processo (UTC no container), entao ler o
 * ano/mes/dia em UTC devolve a data que o Postgres agrupou — e nao "o mesmo
 * instante em Brasil", que trocaria o dia para quem agrupa por horario local.
 */
function asDayKey(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return new Date(value).toISOString().slice(0, 10);
  // `date_trunc` sobre `timestamptz` pode voltar como Date ou como string,
  // dependendo do tipo declarado do driver; um `Number` aqui seria um `NaN`
  // silencioso virando chave de grafico.
  throw new Error("data_trunc devolveu um dia ilegível");
}

export const drizzleAnalyticsRepository: AnalyticsRepository = {
  async sellerSummary(sellerId) {
    const mine = eq(items.sellerId, sellerId);

    const [byStatus, byType, active, contested] = await Promise.all([
      db.select({ status: items.status, total: count() }).from(items).where(mine).groupBy(items.status),
      db.select({ type: items.type, total: count() }).from(items).where(mine).groupBy(items.type),
      db
        .select({ total: count(), sum: sum(items.minInitialBid) })
        .from(items)
        .where(and(mine, eq(items.status, "active"))),
      db
        .select({ id: items.id, title: items.title, bids: count(bids.id), highestBid: max(bids.amount) })
        .from(items)
        .leftJoin(bids, eq(bids.itemId, items.id))
        .where(mine)
        // `count(bids.id)` e 0 (e nao 1) no LEFT JOIN sem correspondencia, entao
        // o `having` e o que tira do ranking o item que ninguem disputou.
        .groupBy(items.id, items.title)
        .having(sql`count(${bids.id}) > 0`)
        .orderBy(desc(count(bids.id)), desc(max(bids.amount)))
        .limit(5),
    ]);

    return {
      totalItems: byStatus.reduce((acc, r) => acc + r.total, 0),
      activeItems: active[0]?.total ?? 0,
      // `sum` de `integer` volta `bigint` do Postgres, e o `pg` entrega
      // `bigint`/`numeric` como TEXTO. O `Number` fecha os dois casos.
      listedValue: Number(active[0]?.sum ?? 0),
      itemsByStatus: byStatus as { status: ItemStatus; total: number }[],
      itemsByType: byType as { type: ItemType; total: number }[],
      mostContested: contested as unknown as ContestedItem[],
    } satisfies SellerSummary;
  },

  async sellerSeries(sellerId, days) {
    const since = windowStart(days);
    const until = new Date();

    const [bids_, created] = await Promise.all([
      // o join pelo `seller_id` do ITEM e o que distingue "lances que eu recebi"
      // de "meus lances" (que e a consulta do comprador, por `bidder_id`).
      db
        .select({ day: LOCAL_DAY, total: count() })
        .from(bids)
        .innerJoin(items, eq(items.id, bids.itemId))
        .where(and(eq(items.sellerId, sellerId), sql`${bids.createdAt} >= ${since}`))
        .groupBy(LOCAL_DAY)
        .orderBy(LOCAL_DAY),
      db
        .select({ day: LOCAL_DAY_OF_ITEM, total: count() })
        .from(items)
        .where(and(eq(items.sellerId, sellerId), sql`${items.createdAt} >= ${since}`))
        .groupBy(LOCAL_DAY_OF_ITEM)
        .orderBy(LOCAL_DAY_OF_ITEM),
    ]);

    return {
      bidsPerDay: fillDays(bids_.map((b) => ({ day: asDayKey(b.day), total: b.total })), days, until),
      itemsCreatedPerDay: fillDays(created.map((c) => ({ day: asDayKey(c.day), total: c.total })), days, until),
    } satisfies SellerSeries;
  },

  async buyerSummary(bidderId, days) {
    const since = windowStart(days);
    const until = new Date();
    const mine = eq(bids.bidderId, bidderId);
    const inWindow = and(mine, sql`${bids.createdAt} >= ${since}`);

    // ponytail: TRES consultas, e nao uma. Os totais (`totalBids`,
    // `watchedItems`, `leading`) sao da JANELA INTEIRA; a lista de
    // recentes e limitada a 8 por escolha de tela. Derivar `leading` dos 8
    // mais recentes e subtrair do total da janela daria um `superado` sem
    // sentido (contaria como "superado" todo lance de fora dos 8). Por isso o
    // `count(*) filter (where ...)` e a subquery do MAIOR_DO_ITEM, e nao os 8.
    const [perDay, totals, recent] = await Promise.all([
      db
        .select({ day: LOCAL_DAY, total: count() })
        .from(bids)
        .where(inWindow)
        .groupBy(LOCAL_DAY)
        .orderBy(LOCAL_DAY),
      db
        .select({
          totalBids: count(),
          watchedItems: sql<number>`count(distinct ${bids.itemId})`,
          leading: sql<number>`count(*) filter (where ${bids.amount} = ${HIGHEST_ON_ITEM})`,
        })
        .from(bids)
        .where(inWindow),
      // o join no `user` e so para o slug do vendedor, de que a rota publica
      // `/[slug]/[itemId]` precisa para nao cair em 404. Uma coluna, uma volta.
      db
        .select({
          id: bids.id,
          itemId: bids.itemId,
          itemTitle: items.title,
          sellerSlug: userTable.slug,
          amount: bids.amount,
          createdAt: bids.createdAt,
          highestOnItem: HIGHEST_ON_ITEM,
        })
        .from(bids)
        .innerJoin(items, eq(items.id, bids.itemId))
        .innerJoin(userTable, eq(userTable.id, items.sellerId))
        .where(inWindow)
        .orderBy(desc(bids.createdAt))
        .limit(8),
    ]);

    const totalBids = Number(totals[0]?.totalBids ?? 0);
    const leading = Number(totals[0]?.leading ?? 0);

    return {
      totalBids,
      watchedItems: Number(totals[0]?.watchedItems ?? 0),
      leading,
      outbid: totalBids - leading,
      bidsPerDay: fillDays(perDay.map((d) => ({ day: asDayKey(d.day), total: d.total })), days, until),
      recent: recent.map((r) => ({
        id: r.id,
        itemId: r.itemId,
        itemTitle: r.itemTitle,
        sellerSlug: r.sellerSlug,
        amount: Number(r.amount),
        createdAt: r.createdAt,
        isLeading: r.amount === r.highestOnItem,
      })) satisfies RecentBid[],
    } satisfies BuyerSummary;
  },
};
