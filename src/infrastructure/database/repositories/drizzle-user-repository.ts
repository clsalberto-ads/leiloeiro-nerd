import { eq, inArray, sql } from "drizzle-orm";
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
export const drizzleVitrineDeVendedorRepository: VitrineDeVendedorRepository = {
  async findVitrineBySlug(slug) {
    const [row] = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        slug: userTable.slug,
        image: userTable.image,
        criadoEm: userTable.createdAt,
        totalDeItensAtivos: sql<number>`(select count(*)::int from ${items} i where i.seller_id = ${userTable.id} and i.status = 'active')`,
      })
      .from(userTable)
      .where(eq(userTable.slug, slug))
      .limit(1);
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