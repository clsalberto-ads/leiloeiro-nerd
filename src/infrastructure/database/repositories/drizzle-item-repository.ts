import { type InferSelectModel } from "drizzle-orm";
import { and, asc, count, desc, eq, max, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/infrastructure/database/drizzle";
import { bids, itemImages, items } from "@/infrastructure/database/schema";
import {
  STATUS_LABELS,
  TYPE_LABELS,
  type CreateItemInput,
  type Item,
  type ItemListFilter,
  type ItemListResult,
  type ItemLister,
  type ItemOrderBy,
  type ItemRepository,
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
// que e exatamente o que o `containsIgnoringAccents` do `DataTable` foi feito para nao
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

// ponytail: a dobra e do MESMO jeito nas tres colunas que o `q` le, e o rotulo
// precisa dela tanto quanto o titulo — sem dobrar os dois lados, "leilao" nao
// acharia "Em leilao" e "acao" nao acharia "Ação". Por isso o SQL carrega SEIS
// tabelas de dobra e nao duas: tres colunas, dois lados cada.
function fold(expressao: SQL): SQL {
  return sql`translate(lower(${expressao}), ${COMPOSTOS}, ${SIMPLES})`;
}

// ponytail: o `CASE` e a ponte entre o enum gravado e o rotulo que o usuario le.
// Sem ele a busca so conhece "active" e "service", e "Em leilao" deixa de achar —
// que foi exatamente o que a busca no cliente acertava (o `accessorFn` da coluna
// entregava o rotulo) e o que o modo servidor tinha desfeito.
//
// Os rotulos entram como PARAMETRO e sao lidos de `STATUS_LABELS`/`TYPE_LABELS`,
// do dominio: e o que mantem o vocabulario em um lugar so. A alternativa — escrever
// os rotulos no proprio SQL, ou em um segundo mapa aqui dentro — seria uma segunda
// fonte, e o defeito dela e silencioso nos dois sentidos: um rotulo trocado no mapa
// e nao no SQL deixa a busca casando com um texto que ninguem ve, e um rotulo
// trocado no SQL e nao no mapa faz a busca divergir do badge.
//
// A ordem dos `WHEN` e a ordem de DECLARACAO do mapa, que e a ordem em que o
// vendedor leria a triagem, e nao a alfabetica do enum: no `CASE` a ordem nao muda
// o resultado (as chaves sao exaustivas e distintas), e escolher uma delas e uma
// leitura e nao um contrato — o que e contrato e a chave estar colada no rotulo
// certo, e o `when <periodKey> then <rotulo>` gera os dois como parametros vizinhos
// justamente para isso poder ser conferido.
function enumLabel<T extends string>(column: AnyPgColumn, labels: Record<T, string>): SQL {
  const pairs = Object.entries(labels) as [T, string][];
  const branches = pairs.map(([key, label]) => sql`when ${key} then ${label}`);
  return sql`case ${column} ${sql.join(branches, sql` `)} end`;
}

function contains(text: SQL, needle: SQL): SQL {
  return sql`strpos(${text}, ${needle}) > 0`;
}

// ponytail: `q` le tres colunas, nao uma. A ordem (titulo, status, tipo) nao muda
// o conjunto devolvido — e um `OR` — mas muda a ordem em que as condicoes sao
// avaliadas, e por isso a lista comeca pelo texto que o usuario digitou: e a coluna
// onde a busca tem mais chance de casar.
function searchByLabelOrTitle(termo: string): SQL | undefined {
  const needle = fold(sql`${termo}`);
  return or(
    contains(fold(sql`${items.title}`), needle),
    contains(fold(enumLabel(items.status, STATUS_LABELS)), needle),
    contains(fold(enumLabel(items.type, TYPE_LABELS)), needle),
  );
}

// ponytail: a coluna de `orderBy` e um `Record` com as MESMAS chaves da union do
// dominio, e e exaustivo de proposito: um `ItemOrderBy` novo entra no compilador
// quebrando aqui, em vez de virar um `ORDER BY` ausente que so apareceria como "a
// tabela nao ordena quando clico nessa coluna".
const COLUMN_OF: Record<ItemOrderBy, AnyPgColumn> = {
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
function sortItems(filter?: ItemListFilter): SQL[] {
  const column = COLUMN_OF[filter?.orderBy ?? "createdAt"];
  const direcao = filter?.orderBy === undefined || filter.direction === "desc" ? desc : asc;
  return [direcao(column), asc(items.id)];
}

// ponytail: `if (filter?.q)` e o que faz "q ausente" e "q em branco" serem a mesma
// coisa — o `listSellerItems` apara o termo, mas `listBySellerId` e publico na
// `ItemLister` e o contrato nao proibe ninguem de chamar direto. Um `q: ""` viraria
// `strpos(..., '') > 0`, que e sempre verdadeiro: a busca "esvaziaria" o filtro
// status sem parecer que fez nada, e o `total` e a contagem passariam a divergir
// da tela sem erro visivel. Aqui o vazio e ausencia de filtro, e o `q` nao entra no
// `where`. E os tres filtros andam juntos, sempre nesta ordem, porque e a mesma
// lista que vai para as DUAS consultas.
function predicates(sellerId: string, filter?: ItemListFilter): SQL[] {
  const condicoes: SQL[] = [eq(items.sellerId, sellerId)];
  if (filter?.status) condicoes.push(eq(items.status, filter.status));
  const search = filter?.q ? searchByLabelOrTitle(filter.q) : undefined;
  if (search) condicoes.push(search);
  return condicoes;
}

// ponytail: o `> 0` e o ultimo filtro antes do SQL, e ele existe porque `listBySellerId`
// e publico na `ItemLister`: quem chamar direto, sem passar pelo `listSellerItems`, nao
// tem a normalizacao. Um `LIMIT -1` aqui e erro do Postgres ("LIMIT must not be
// negative"), nao um resultado vazio — e o `offset` negativo tambem. Custa tres
// caracteres e fecha a porta de uma URL digitada a mao.
function sliceForSql(value?: number): number | undefined {
  return value !== undefined && value > 0 ? value : undefined;
}

async function listBySeller(
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
  const where = and(...predicates(sellerId, filter));
  const query = db.select().from(items).where(where).orderBy(...sortItems(filter));
  // ponytail: o `limit`/`offset` sao aplicados no proprio builder e o retorno
  // descartado, e a Forma CORRETA de usar — o comentario anterior aqui
  // afirmava o contrario ("o drizzle devolve um builder NOVO") e foi verificado
  // contra o installed: `select.js:680-710` faz `this.config.limit = limit` e
  // `return this`. `const paginada = consulta.limit(n)` seria portanto
  // equivalente, nao um bug de paginacao sumindo. A diferenca real e outra: o
  // `Promise.all` abaixo precisa da MESMA instancia (o `where` e o `orderBy`
  // sao os dois aplicados nela), e reatribuir a variavel para o resultado do
  // `limit` tornaria o nome `consulta` um objeto diferente do que o `count`
  // vizinho espera. O teste desta pagina mocka o builder com um chain que
  // devolve `a si mesmo`, entao ele trava o COMPORTAMENTO, nao a frase.
  const limite = sliceForSql(filter?.limit);
  const deslocamento = sliceForSql(filter?.offset);
  if (limite !== undefined) query.limit(limite);
  if (deslocamento !== undefined) query.offset(deslocamento);
  const [linhas, contagem] = await Promise.all([
    query,
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

  // ponytail: `findBySellerId` virou uma linha sobre `listBySeller`, e nao o
  // contrario. Quem chama este metodo (a vitrine publica, via
  // `listActiveItemsBySellerId`) quer o conjunto INTEIRO, sem pagina e sem total — e
  // essa e a unica forma de ele continuar sendo "tudo o que casar com o filtro". A
  // implementacao e a mesma, entao os dois caminhos nao podem divergir em filtro nem
  // em ordenacao: o `id` no desempate e a unica diferenca de ordem, e ela e o
  // conserto, nao a regressao.
  findBySellerId: async (sellerId, filter) => {
    const { items: list } = await listBySeller(sellerId, filter);
    return list;
  },
  listBySellerId: listBySeller,

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
      // ponytail: o `FOR UPDATE` na linha do `items` e o que faz esta
      // transacao valer alguma coisa. O `max(position)` e um agregado: ele nao
      // trava nada, e `SELECT ... FOR UPDATE` nem e legal sobre agregado, entao
      // a transacao sozinha nao dava exclusao mútua nenhuma. Duas abas do form
      // de edicao salvando ao mesmo tempo liam `maxPos = 0` as duas, inseriam
      // `position = 1` as duas, e o `image_url` (o subquery `order by position
      // asc limit 1` abaixo, sem desempate) passava a escolher entre dois
      // arquivos conforme o plano do Postgres. Travar a linha do item e o mesmo
      // mecanismo que o `placeBid` usa em `drizzle-bid-repository.ts:29`, e
      // nao cria ciclo: `placeBid` nunca toca `item_images`.
      await tx.execute(sql`SELECT id FROM ${items} WHERE id = ${itemId} FOR UPDATE`);
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
    // ponytail: uma transacao, e nao tres `await` soltos. O `SELECT` do `itemId`
    // e o dado que o `UPDATE` de `items.image_url` precisa; sem a transacao, uma
    // conexao perdida entre o `DELETE` e o `UPDATE` deixava
    // `items.image_url` apontando para uma linha que ja nao existia — a capa do
    // item sumia da vitrine e da pagina de detalhe, sem como recuperar sem um
    // `UPDATE` manual. O `SELECT` tambem nao e mais redundante: e a unica forma
    // de saber de qual item recalcular a capa.
    await db.transaction(async (tx) => {
      const [row] = await tx.select().from(itemImages).where(eq(itemImages.id, imageId)).limit(1);
      await tx.delete(itemImages).where(eq(itemImages.id, imageId));
      if (row) {
        await tx
          .update(items)
          .set({
            imageUrl: sql`(select url from ${itemImages} where ${itemImages.itemId} = ${row.itemId} order by position asc limit 1)`,
            updatedAt: new Date(),
          })
          .where(eq(items.id, row.itemId));
      }
    });
  },
};
