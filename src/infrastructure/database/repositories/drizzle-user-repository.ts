import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { user as userTable } from "@/infrastructure/database/auth-schema";
import type { UserProfile, UserRepository } from "@/domain/repositories/user-repository";

export const drizzleUserRepository: UserRepository = {
  async updateProfile(userId, input) {
    const [row] = await db
      .update(userTable)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
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

  async updateRole(userId, role, slug) {
    const [row] = await db
      .update(userTable)
      .set({ role, slug })
      .where(eq(userTable.id, userId))
      .returning({ id: userTable.id, name: userTable.name, email: userTable.email, phone: userTable.phone, slug: userTable.slug, address: userTable.address, role: userTable.role });
    if (!row) throw new Error("Usuário não encontrado");
    return { ...row, role: row.role as UserProfile["role"] };
  },
};