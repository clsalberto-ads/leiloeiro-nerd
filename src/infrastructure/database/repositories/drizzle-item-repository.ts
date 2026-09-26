import { type InferSelectModel } from "drizzle-orm";
import { and, asc, count, desc, eq, max, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/infrastructure/database/drizzle";
import { bids, itemImages, items } from "@/infrastructure/database/schema";
import type {
  CreateItemInput,
  Item,
  ItemListFilter,
  ItemListResult,
  ItemLister,
  ItemOrderBy,
  ItemRepository,
} from "@/domain/repositories/item-repository";

type ItemRow = InferSelectModel<typeof items>;

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    sellerId: row.sellerId,
    title: row.title,
    description: row.description,
    type: row.type,
    imageUrl: row.imageUrl,
    minInitialBid: row.minInitialBid,
    minBidIncrement: row.minBidIncrement,
    bidDeadline: row.bidDeadline,
    paymentDeadlineDays: row.paymentDeadlineDays,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ponytail: a dobra de acento acontece AQUI, em SQL, e nao em JS, porque quem decide
// o que casa e o Postgres. `unaccent()` resolveria, mas e uma extensao do servidor: se
// o banco nao a tiver, a query quebra com "function unaccent(text) does not exist" — um
// 500 no primeiro "a" digitado na busca. `translate()` e nativa, nao precisa de
// extensao, e so sabe trocar caracteres: e uma TABELA FECHADA de 25 letras do
// portugues, nao uma decomposicao Unicode. A alternativa seria manter o termo dobrado
// em JS e dobrar a coluna em SQL, mas ai a regra de dobra vive em duas linguagens e o
// dia que as duas divergirem a busca volta a depender do acento que o usuario digitou.
//
// Coluna E termo dobram com a MESMA tabela, e isso e load-bearing: dobrar so a coluna
// troca o defeito de lugar — "acao" passaria a casar e "Acao" (com acento) a sumir,
// que e exatamente o que o `contemSemAcento` do `DataTable` foi feito para nao
// acontecer. As DUAS tabelas so tem minuscula, e por isso a ordem de `lower` e
// `translate` esta invertida em relacao ao que parece natural: e `translate(lower(x))`,
// e nao `lower(translate(x))`. Com o `lower` depois, "AÇÃO" e "Óculos" nao casariam
// com "Ação" e "Óculos" — o `translate` roda antes de o `lower` existir e nao tem
// "A", "Ç" ou "Ó" na tabela para trocar. Rodado no Postgres 17, `lower(translate(x))`
// devolvia zero resultado para "AÇÃO", "Ação" e "óculos"; com a ordem trocada, os tres
// acham. Um `lower` a mais nao resolve: e o `lower` que tem que vir antes.
//
// E `strpos`, e nao `ilike`/`like`: `ilike` resolveria caixa e acento num passo so, mas
// traz de volta os metacaracteres do `LIKE` — o usuario digitando "%" receberia a lista
// inteira, e "_" casaria um caractere qualquer. `strpos` e substring puro, sem
// coringa, e e o mesmo `includes` que o filtro do cliente fazia. No Postgres 17,
// `q="%"` acha so o item que tem "%" no titulo.
const COMPOSTOS = "áàâãäéèêëíìîïóòôõöúùûüçñý";
const SIMPLES = "aaaaaeeeeiiiiooooouuuucny";

function buscaPorTitulo(termo: string): SQL {
  const coluna = sql`translate(lower(${items.title}), ${COMPOSTOS}, ${SIMPLES})`;
  const agulha = sql`translate(lower(${termo}), ${COMPOSTOS}, ${SIMPLES})`;
  return sql`strpos(${coluna}, ${agulha}) > 0`;
}

// ponytail: a coluna de `orderBy` e um `Record` com as MESMAS chaves da union do
// dominio, e e exaustivo de proposito: um `ItemOrderBy` novo entra no compilador
// quebrando aqui, em vez de virar um `ORDER BY` ausente que so apareceria como "a
// tabela nao ordena quando clico nessa coluna".
const COLUNA_DE: Record<ItemOrderBy, AnyPgColumn> = {
  createdAt: items.createdAt,
  title: items.title,
  minInitialBid: items.minInitialBid,
  bidDeadline: items.bidDeadline,
};

// ponytail: sem `orderBy`, `createdAt desc` — a ordem que esta listagem ja tinha, e nao
// "asc" como nas demais colunas. E o `asc(items.id)` no fim que torna a PAGINACAO
// confiavel: dois itens criados no mesmo `now()` (o default do banco) empatam em
// `createdAt`, e um `ORDER BY` sem desempate deixa a ordem desses dois a cargo do
// planejador, que pode mudar entre requisicoes — a pagina 1 e a pagina 2 viriam com o
// mesmo item, ou pular um, e o rodape "11-20 de 47" deixaria de bater. Custa uma
// coluna no `ORDER BY` e fecha a chave de ordenacao: com ela a ordem e total.
function ordenarItens(filter?: ItemListFilter): SQL[] {
  const coluna = COLUNA_DE[filter?.orderBy ?? "createdAt"];
  const direcao = filter?.orderBy === undefined || filter.direction === "desc" ? desc : asc;
  return [direcao(coluna), asc(items.id)];
}

// ponytail: `if (filter?.q)` e o que faz "q ausente" e "q em branco" serem a mesma
// coisa — o `listSellerItems` apara o termo, mas `listBySellerId` e publico na
// `ItemLister` e o contrato nao proibe ninguem de chamar direto. Um `q: ""` viraria
// `strpos(..., '') > 0`, que e sempre verdadeiro: a busca "esvaziaria" o filtro
// status sem parecer que fez nada, e o `total` e a contagem passariam a divergir
// da tela sem erro visivel. Aqui o vazio e ausencia de filtro, e o `q` nao entra no
// `where`. E os tres filtros andam juntos, sempre nesta ordem, porque e a mesma
// lista que vai para as DUAS consultas.
function predicados(sellerId: string, filter?: ItemListFilter): SQL[] {
  const condicoes: SQL[] = [eq(items.sellerId, sellerId)];
  if (filter?.status) condicoes.push(eq(items.status, filter.status));
  if (filter?.q) condicoes.push(buscaPorTitulo(filter.q));
  return condicoes;
}

// ponytail: o `> 0` e o ultimo filtro antes do SQL, e ele existe porque `listBySellerId`
// e publico na `ItemLister`: quem chamar direto, sem passar pelo `listSellerItems`, nao
// tem a normalizacao. Um `LIMIT -1` aqui e erro do Postgres ("LIMIT must not be
// negative"), nao um resultado vazio — e o `offset` negativo tambem. Custa tres
// caracteres e fecha a porta de uma URL digitada a mao.
function fatiaParaSQL(valor?: number): number | undefined {
  return valor !== undefined && valor > 0 ? valor : undefined;
}

async function listarPorVendedor(
  sellerId: string,
  filter?: ItemListFilter,
): Promise<ItemListResult> {
  // ponytail: `where` nasce UMA vez e as DUAS consultas recebem o mesmo objeto. Nao e
  // detalhe de estilo: e o que segura o `total` no conjunto filtrado. Montar o `where`
  // da contagem de novo (mesmo com o mesmo filtro) daria o numero certo tambem — mas a
  // proxima linha de um patch futuro e a que pode trocar um filtro por
  // `eq(items.sellerId)` sozinho, e o rodape passa a contar a tabela inteira sem
  // nenhum erro visivel. Com o objeto compartilhado, esse desvio aparece no codigo, e
  // o teste de unidade segura o outro lado dele.
  const where = and(...predicados(sellerId, filter));
  const consulta = db.select().from(items).where(where).orderBy(...ordenarItens(filter));
  // ponytail: o retorno de `limit()`/`offset()` e descartado de proposito. O drizzle
  // devolve um builder NOVO, e o `where`/`orderBy` acima ja esta montado — reatribuir
  // (ou trocar por `const paginada = consulta.limit(n)`) faria a paginacao sumir sem
  // erro nenhum, que e a forma mais cara de bug de paginacao que existe.
  const limite = fatiaParaSQL(filter?.limit);
  const deslocamento = fatiaParaSQL(filter?.offset);
  if (limite !== undefined) consulta.limit(limite);
  if (deslocamento !== undefined) consulta.offset(deslocamento);
  const [linhas, contagem] = await Promise.all([
    consulta,
    db.select({ n: count() }).from(items).where(where),
  ]);
  return { items: linhas.map(toItem), total: contagem[0]?.n ?? 0 };
}

export const drizzleItemRepository: ItemRepository & ItemLister = {
  async create(input: CreateItemInput) {
    const [row] = await db
      .insert(items)
      .values({
        sellerId: input.sellerId,
        title: input.title,
        description: input.description,
        type: input.type,
        minInitialBid: input.minInitialBid,
        minBidIncrement: input.minBidIncrement,
        bidDeadline: input.bidDeadline,
        paymentDeadlineDays: input.paymentDeadlineDays,
      })
      .returning();
    return toItem(row!);
  },

  async update(id, input) {
    const [row] = await db
      .update(items)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.minInitialBid !== undefined ? { minInitialBid: input.minInitialBid } : {}),
        ...(input.minBidIncrement !== undefined ? { minBidIncrement: input.minBidIncrement } : {}),
        ...(input.bidDeadline !== undefined ? { bidDeadline: input.bidDeadline } : {}),
        ...(input.paymentDeadlineDays !== undefined ? { paymentDeadlineDays: input.paymentDeadlineDays } : {}),
        updatedAt: new Date(),
      })
      .where(eq(items.id, id))
      .returning();
    return row ? toItem(row) : null;
  },

  async findById(id) {
    const [row] = await db.select().from(items).where(eq(items.id, id)).limit(1);
    return row ? toItem(row) : null;
  },

  // ponytail: `findBySellerId` virou uma linha sobre `listarPorVendedor`, e nao o
  // contrario. Quem chama este metodo (a vitrine publica, via
  // `listActiveItemsBySellerId`) quer o conjunto INTEIRO, sem pagina e sem total — e
  // essa e a unica forma de ele continuar sendo "tudo o que casar com o filtro". A
  // implementacao e a mesma, entao os dois caminhos nao podem divergir em filtro nem
  // em ordenacao: o `id` no desempate e a unica diferenca de ordem, e ela e o
  // conserto, nao a regressao.
  findBySellerId: async (sellerId, filter) => {
    const { items: lista } = await listarPorVendedor(sellerId, filter);
    return lista;
  },
  listBySellerId: listarPorVendedor,

  async delete(id) {
    await db.delete(items).where(eq(items.id, id));
  },

  async setStatus(id, status) {
    const [row] = await db
      .update(items)
      .set({ status, updatedAt: new Date() })
      .where(eq(items.id, id))
      .returning();
    return row ? toItem(row) : null;
  },

  async countBids(itemId) {
    const [row] = await db
      .select({ n: count() })
      .from(bids)
      .where(eq(bids.itemId, itemId));
    return row?.n ?? 0;
  },

  async findImagesByItemId(itemId) {
    const rows = await db
      .select()
      .from(itemImages)
      .where(eq(itemImages.itemId, itemId))
      .orderBy(itemImages.position);
    return rows.map((r) => ({ id: r.id, itemId: r.itemId, url: r.url, position: r.position, createdAt: r.createdAt }));
  },

  async findImageById(imageId) {
    const [row] = await db.select().from(itemImages).where(eq(itemImages.id, imageId)).limit(1);
    return row
      ? { id: row.id, itemId: row.itemId, url: row.url, position: row.position, createdAt: row.createdAt }
      : null;
  },

  async createImages(itemId, urls) {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select({ maxPos: max(itemImages.position) })
        .from(itemImages)
        .where(eq(itemImages.itemId, itemId));
      const start = existing[0]?.maxPos ?? -1;
      const values = urls.map((url, i) => ({ itemId, url, position: start + 1 + i }));
      const rows = await tx.insert(itemImages).values(values).returning();
      await tx
        .update(items)
        .set({
          imageUrl: sql`(select url from ${itemImages} where ${itemImages.itemId} = ${itemId} order by position asc limit 1)`,
          updatedAt: new Date(),
        })
        .where(eq(items.id, itemId));
      return rows.map((r) => ({ id: r.id, itemId: r.itemId, url: r.url, position: r.position, createdAt: r.createdAt }));
    });
  },

  async deleteImage(imageId) {
    const [row] = await db.select().from(itemImages).where(eq(itemImages.id, imageId)).limit(1);
    await db.delete(itemImages).where(eq(itemImages.id, imageId));
    if (row) {
      await db
        .update(items)
        .set({
          imageUrl: sql`(select url from ${itemImages} where ${itemImages.itemId} = ${row.itemId} order by position asc limit 1)`,
          updatedAt: new Date(),
        })
        .where(eq(items.id, row.itemId));
    }
  },
};
