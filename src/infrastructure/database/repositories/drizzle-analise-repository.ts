import { and, count, desc, eq, max, sql, sum } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { FUSO, diaLocalDe, inicioDoDiaLocal } from "@/lib/fuso";
import { bids, items } from "@/infrastructure/database/schema";
import { user as userTable } from "@/infrastructure/database/auth-schema";
import type { ItemStatus, ItemType } from "@/domain/repositories/item-repository";
import type {
  AnaliseRepository,
  ItemDisputado,
  LanceRecente,
  PontoPorDia,
  ResumoDoComprador,
  ResumoDoVendedor,
  SeriesDoVendedor,
} from "@/domain/repositories/analise-repository";

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
// lida pela celula de prazo da tabela de itens (`colunas.tsx`), via
// `@/lib/fuso`. Se os dois divergirem, o grafico de "lances por dia" contaria
// dias diferentes dos que a lista de itens mostra — e nada accuse isso, porque
// os dois continuam "funcionando".
const DIA_LOCAL = sql`date_trunc('day', ${bids.createdAt} at time zone ${sql.raw(`'${FUSO}'`)})`;
const DIA_LOCAL_DO_ITEM = sql`date_trunc('day', ${items.createdAt} at time zone ${sql.raw(`'${FUSO}'`)})`;

/** O maior lance de qualquer pessoa no item do lance `alias`. */
const MAIOR_DO_ITEM = sql`(select max(b2.amount) from ${bids} b2 where b2.item_id = ${bids.itemId})`;

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
function preencherDias(linhas: { dia: string; total: number }[], dias: number, ate: Date): PontoPorDia[] {
  const mapa = new Map(linhas.map((l) => [l.dia, l.total]));
  const saida: PontoPorDia[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    // ponytail: a CHAVE do dia vem de `diaLocalDe`, e nao de `toISOString().slice`.
    // A janela e uma lista de dias do fuso do produto, e ela tem de casar com as
    // chaves que o SQL agrupa (`date_trunc` em `at time zone FUSO`). Entre 18h e
    // 21h BRT, `toISOString()` devolve a data de amanha e o ultimo ponto do
    // grafico saia rotulado com o dia errado.
    const dia = diaLocalDe(inicioDoDiaLocal(i, ate));
    saida.push({ dia, total: mapa.get(dia) ?? 0 });
  }
  return saida;
}

// ponytail: `inicioDoDiaLocal` e nao `setUTCHours(0,0,0,0)`. O limite inferior do
// `WHERE` e um instante, e ele tem de ser a MEIA-NOITE do fuso do produto: em UTC
// a janela de 30 dias comecava as 21:00 de BRT do dia anterior, e o lance das
// 00h30 do primeiro dia ficava fora do grafico. Este e o mesmo par que o
// `datetime-local` usa, entao o grafico e o formulario concordam sobre o dia.
function inicioDaJanela(dias: number): Date {
  return inicioDoDiaLocal(dias - 1);
}

/**
 * `date_trunc` devolve `timestamp sem fuso`; o `pg` o entrega como `Date`
 * interpretado no fuso do processo (UTC no container), entao ler o
 * ano/mes/dia em UTC devolve a data que o Postgres agrupou — e nao "o mesmo
 * instante em Brasil", que trocaria o dia para quem agrupa por horario local.
 */
function comoChaveDia(valor: unknown): string {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === "string") return new Date(valor).toISOString().slice(0, 10);
  // `date_trunc` sobre `timestamptz` pode voltar como Date ou como string,
  // dependendo do tipo declarado do driver; um `Number` aqui seria um `NaN`
  // silencioso virando chave de grafico.
  throw new Error("data_trunc devolveu um dia ilegível");
}

export const drizzleAnaliseRepository: AnaliseRepository = {
  async resumoDoVendedor(sellerId) {
    const meu = eq(items.sellerId, sellerId);

    const [porStatus, porTipo, ativos, disputados] = await Promise.all([
      db.select({ status: items.status, total: count() }).from(items).where(meu).groupBy(items.status),
      db.select({ tipo: items.type, total: count() }).from(items).where(meu).groupBy(items.type),
      db
        .select({ total: count(), soma: sum(items.minInitialBid) })
        .from(items)
        .where(and(meu, eq(items.status, "active"))),
      db
        .select({ id: items.id, title: items.title, lances: count(bids.id), maiorLance: max(bids.amount) })
        .from(items)
        .leftJoin(bids, eq(bids.itemId, items.id))
        .where(meu)
        // `count(bids.id)` e 0 (e nao 1) no LEFT JOIN sem correspondencia, entao
        // o `having` e o que tira do ranking o item que ninguem disputou.
        .groupBy(items.id, items.title)
        .having(sql`count(${bids.id}) > 0`)
        .orderBy(desc(count(bids.id)), desc(max(bids.amount)))
        .limit(5),
    ]);

    return {
      totalItens: porStatus.reduce((acc, r) => acc + r.total, 0),
      itensAtivos: ativos[0]?.total ?? 0,
      // `sum` de `integer` volta `bigint` do Postgres, e o `pg` entrega
      // `bigint`/`numeric` como TEXTO. O `Number` fecha os dois casos.
      valorListado: Number(ativos[0]?.soma ?? 0),
      itensPorStatus: porStatus as { status: ItemStatus; total: number }[],
      itensPorTipo: porTipo as { tipo: ItemType; total: number }[],
      maisDisputados: disputados as unknown as ItemDisputado[],
    } satisfies ResumoDoVendedor;
  },

  async seriesDoVendedor(sellerId, dias) {
    const desde = inicioDaJanela(dias);
    const ate = new Date();

    const [lances, criados] = await Promise.all([
      // o join pelo `seller_id` do ITEM e o que distingue "lances que eu recebi"
      // de "meus lances" (que e a consulta do comprador, por `bidder_id`).
      db
        .select({ dia: DIA_LOCAL, total: count() })
        .from(bids)
        .innerJoin(items, eq(items.id, bids.itemId))
        .where(and(eq(items.sellerId, sellerId), sql`${bids.createdAt} >= ${desde}`))
        .groupBy(DIA_LOCAL)
        .orderBy(DIA_LOCAL),
      db
        .select({ dia: DIA_LOCAL_DO_ITEM, total: count() })
        .from(items)
        .where(and(eq(items.sellerId, sellerId), sql`${items.createdAt} >= ${desde}`))
        .groupBy(DIA_LOCAL_DO_ITEM)
        .orderBy(DIA_LOCAL_DO_ITEM),
    ]);

    return {
      lancesPorDia: preencherDias(lances.map((l) => ({ dia: comoChaveDia(l.dia), total: l.total })), dias, ate),
      itensCriadosPorDia: preencherDias(criados.map((l) => ({ dia: comoChaveDia(l.dia), total: l.total })), dias, ate),
    } satisfies SeriesDoVendedor;
  },

  async resumoDoComprador(bidderId, dias) {
    const desde = inicioDaJanela(dias);
    const ate = new Date();
    const meus = eq(bids.bidderId, bidderId);
    const naJanela = and(meus, sql`${bids.createdAt} >= ${desde}`);

    // ponytail: TRES consultas, e nao uma. Os totais (`totalLances`,
    // `itensAcompanhados`, `liderando`) sao da JANELA INTEIRA; a lista de
    // recentes e limitada a 8 por escolha de tela. Derivar `liderando` dos 8
    // mais recentes e subtrair do total da janela daria um `superado` sem
    // sentido (contaria como "superado" todo lance de fora dos 8). Por isso o
    // `count(*) filter (where ...)` e a subquery do MAIOR_DO_ITEM, e nao os 8.
    const [porDia, totais, recentes] = await Promise.all([
      db
        .select({ dia: DIA_LOCAL, total: count() })
        .from(bids)
        .where(naJanela)
        .groupBy(DIA_LOCAL)
        .orderBy(DIA_LOCAL),
      db
        .select({
          totalLances: count(),
          itensAcompanhados: sql<number>`count(distinct ${bids.itemId})`,
          liderando: sql<number>`count(*) filter (where ${bids.amount} = ${MAIOR_DO_ITEM})`,
        })
        .from(bids)
        .where(naJanela),
      // o join no `user` e so para o slug do vendedor, de que a rota publica
      // `/[slug]/[itemId]` precisa para nao cair em 404. Uma coluna, uma volta.
      db
        .select({
          id: bids.id,
          itemId: bids.itemId,
          itemTitle: items.title,
          vendedorSlug: userTable.slug,
          amount: bids.amount,
          createdAt: bids.createdAt,
          maiorDoItem: MAIOR_DO_ITEM,
        })
        .from(bids)
        .innerJoin(items, eq(items.id, bids.itemId))
        .innerJoin(userTable, eq(userTable.id, items.sellerId))
        .where(naJanela)
        .orderBy(desc(bids.createdAt))
        .limit(8),
    ]);

    const totalLances = Number(totais[0]?.totalLances ?? 0);
    const liderando = Number(totais[0]?.liderando ?? 0);

    return {
      totalLances,
      itensAcompanhados: Number(totais[0]?.itensAcompanhados ?? 0),
      liderando,
      superado: totalLances - liderando,
      lancesPorDia: preencherDias(porDia.map((l) => ({ dia: comoChaveDia(l.dia), total: l.total })), dias, ate),
      recentes: recentes.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        itemTitle: l.itemTitle,
        vendedorSlug: l.vendedorSlug,
        amount: Number(l.amount),
        createdAt: l.createdAt,
        liderando: l.amount === l.maiorDoItem,
      })) satisfies LanceRecente[],
    } satisfies ResumoDoComprador;
  },
};
