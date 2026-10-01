import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { user as userTable } from "@/infrastructure/database/auth-schema";
import { items } from "@/infrastructure/database/schema";
import type { UserProfile, UserRepository, VitrineDeVendedorRepository } from "@/domain/repositories/user-repository";

export const drizzleUserRepository: UserRepository = {
  async updateProfile(userId, input) {
    const [row] = await db
      .update(userTable)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, userId))
      .returning({ id: userTable.id, name: userTable.name, email: userTable.email, phone: userTable.phone, slug: userTable.slug, address: userTable.address, role: userTable.role });
    if (!row) throw new Error("Usuário não encontrado");
    return { ...row, role: row.role as UserProfile["role"] };
  },

  async findBySlug(slug) {
    const [row] = await db
      .select({ id: userTable.id, name: userTable.name, slug: userTable.slug })
      .from(userTable)
      .where(eq(userTable.slug, slug))
      .limit(1);
    if (!row) return null;
    if (!row.slug) return null;
    return { id: row.id, name: row.name, slug: row.slug };
  },

  async findById(userId) {
    const [row] = await db
      .select({ id: userTable.id, name: userTable.name, email: userTable.email, phone: userTable.phone, slug: userTable.slug, address: userTable.address, role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    if (!row) return null;
    return { ...row, role: row.role as UserProfile["role"] };
  },

  async findByIds(ids) {
    // `inArray` com lista vazia e `IN ()` no Postgres, que e erro de sintaxe —
    // o `length === 0` devolve antes de chegar la.
    if (ids.length === 0) return [];
    const rows = await db
      .select({ id: userTable.id, name: userTable.name, email: userTable.email, phone: userTable.phone, slug: userTable.slug, address: userTable.address, role: userTable.role })
      .from(userTable)
      .where(inArray(userTable.id, ids));
    return rows.map((row) => ({ ...row, role: row.role as UserProfile["role"] }));
  },

  async updateRole(userId, role, slug) {
    const [row] = await db
      .update(userTable)
      .set({ role, slug, updatedAt: new Date() })
      .where(eq(userTable.id, userId))
      .returning({ id: userTable.id, name: userTable.name, email: userTable.email, phone: userTable.phone, slug: userTable.slug, address: userTable.address, role: userTable.role });
    if (!row) throw new Error("Usuário não encontrado");
    return { ...row, role: row.role as UserProfile["role"] };
  },
};

// ponytail: UMA query com SUBQUERY ESCALAR para a contagem, e nao duas. Medido
// contra o Postgres 17 com o banco de desenvolvimento: a query leva 0,087ms de
// execucao, faz `Index Scan using user_slug_unique` e o `SubPlan` do count fica
// em 0,010ms. Duas queries custariam um segundo round-trip (~0,4ms medido) para
// um numero que cabe num escalar.
//
// A subquery e ESCALAR e correlacionada (`i.seller_id = u.id`), entao devolve UM
// valor por linha do `user` e nao multiplica o resultado — que e o que
// a diferenca entre um `(select count(*) ...)` e um `join lateral`.
//
// O `count(*)::int` e obrigatorio: sem o cast o Postgres devolve `bigint`, o `pg`
// entrega como TEXTO, e `totalDeItensAtivos` viraria a string "3" — que no
// `pluralize` do hero comparada com 1 seria sempre falsa.
// ponytail: a consulta mora numa funcao EXPORTADA e nao inline no metodo, e o
// motivo e o teste. Um teste que montasse a propria query para conferir o SQL
// estaria testando uma COPIA — mudar o repositorio deixaria o teste verde, que e
// a segunda fonte de verdade que este projeto vem desarmando. Com a consulta
// exportada, `drizzle-user-repository.test.ts` afirma o SQL que o codigo de
// producao executa.
export function consultaDeVitrine(slug: string) {
  return db
    .select({
      id: userTable.id,
      name: userTable.name,
      slug: userTable.slug,
      image: userTable.image,
      criadoEm: userTable.createdAt,
      totalDeItensAtivos: sql<number>`count(${items.id})::int`,
    })
    .from(userTable)
    .leftJoin(items, and(eq(items.sellerId, userTable.id), eq(items.status, "active")))
    .where(eq(userTable.slug, slug))
    .groupBy(userTable.id, userTable.name, userTable.slug, userTable.image, userTable.createdAt)
    .limit(1);
}

export const drizzleVitrineDeVendedorRepository: VitrineDeVendedorRepository = {
  async findVitrineBySlug(slug) {
    // ponytail: o `LEFT JOIN` no lugar da subquery correlacionada por um BUG que a
    // suite nao pegou e so a rota real pegou (HTTP 500, `42883 No operator matches`).
    //
    // O desenho anterior era `sql`(select count(*)::int from items i where i.seller_id
    // = ${userTable.id})``. Ele funciona e nao tem N+1, mas o drizzle 0.45 renderiza
    // a coluna de uma tabela que NAO esta no `FROM` da subquery SEM qualificar: saiu
    // `i.seller_id = "id"`, e dentro do escopo da subquery esse `"id"` resolve para
    // `items.id`. A query virava `items.seller_id = items.id` — `text` contra
    // `uuid` — e o Postgres respondia "no operator matches text = uuid".
    // `alias(userTable, "u")` NAO corrige: medido, o drizzle tambem renderiza
    // `"id"` nesse caso. So `sql.raw`("user"."id")` qualifica, e isso amarra o
    // codigo a uma string que ninguem renomeia junto.
    //
    // O `LEFT JOIN` resolve pela via tipada: `items` esta no `FROM`, entao
    // `${items.id}` renderiza `"items"."id"`, e o `eq(items.sellerId, userTable.id)`
    // do `on` fica fora do `sql` e sai qualificado pelos dois lados. O filtro de
    // `active` vai no proprio `on` — e por isso que e `leftJoin` e nao `innerJoin`:
    // um vendedor sem item ativo tem de voltar NA mesma linha, com `count = 0`. Com
    // `innerJoin` a linha sumiria e a vitrine distinguiria "vendedor sem itens" de
    // "vendedor inexistente" — o `notFound()` do shell passaria a responder 404
    // para um vendedor que existe e nao tem nada leiloado.
    const [row] = await consultaDeVitrine(slug);
    if (!row || !row.slug) return null;
    // o objeto e montado campo a campo (como o `findBySlug` acima) porque o
    // `{ ...row }` do plano nao carrega o estreitamento do `!row.slug` para o
    // spread: o `tsc` continua vendo `slug: string | null`.
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      image: row.image,
      criadoEm: row.criadoEm,
      totalDeItensAtivos: Number(row.totalDeItensAtivos),
    };
  },
};