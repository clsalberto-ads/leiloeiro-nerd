import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { pagbankSellerAccounts } from "@/infrastructure/database/schema";
import { decryptToken, encryptToken } from "@/infrastructure/pagbank/token-cipher";
import type {
  PagBankSellerAccount,
  PagBankSellerAccountRepository,
  UpsertPagBankSellerAccountInput,
} from "@/domain/repositories/pagbank-seller-account-repository";

export type PagBankSellerAccountRow = typeof pagbankSellerAccounts.$inferSelect;

// ponytail: o mapper NÃO copia accessToken — a entidade de domínio não tem
// o campo (a mesma proteção que o MP tinha contra vazamento de token).
export function toPagBankSellerAccount(row: PagBankSellerAccountRow): PagBankSellerAccount {
  return {
    id: row.id,
    userId: row.userId,
    accountId: row.accountId,
    tokenExpiresAt: row.tokenExpiresAt,
    connectedAt: row.connectedAt,
  };
}

const SAFE_COLUMNS = {
  id: pagbankSellerAccounts.id,
  userId: pagbankSellerAccounts.userId,
  accountId: pagbankSellerAccounts.accountId,
  tokenExpiresAt: pagbankSellerAccounts.tokenExpiresAt,
  connectedAt: pagbankSellerAccounts.connectedAt,
};

export const drizzlePagBankSellerAccountRepository: PagBankSellerAccountRepository = {
  async findByUserId(userId) {
    const [row] = await db
      .select(SAFE_COLUMNS)
      .from(pagbankSellerAccounts)
      .where(eq(pagbankSellerAccounts.userId, userId))
      .limit(1);
    return row ?? null;
  },

  async findCredentials(userId) {
    const [row] = await db
      .select({
        accessToken: pagbankSellerAccounts.accessToken,
        refreshToken: pagbankSellerAccounts.refreshToken,
        accountId: pagbankSellerAccounts.accountId,
        tokenExpiresAt: pagbankSellerAccounts.tokenExpiresAt,
      })
      .from(pagbankSellerAccounts)
      .where(eq(pagbankSellerAccounts.userId, userId))
      .limit(1);
    if (!row) return null;
    return {
      accessToken: decryptToken(row.accessToken),
      refreshToken: row.refreshToken === null ? null : decryptToken(row.refreshToken),
      accountId: row.accountId,
      tokenExpiresAt: row.tokenExpiresAt,
    };
  },

  async upsert(input: UpsertPagBankSellerAccountInput) {
    const now = new Date();
    const [row] = await db
      .insert(pagbankSellerAccounts)
      .values({
        userId: input.userId,
        accessToken: encryptToken(input.accessToken),
        refreshToken: input.refreshToken === null ? null : encryptToken(input.refreshToken),
        accountId: input.accountId,
        tokenExpiresAt: input.tokenExpiresAt,
        connectedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: pagbankSellerAccounts.userId,
        set: {
          accessToken: encryptToken(input.accessToken),
          refreshToken: input.refreshToken === null ? null : encryptToken(input.refreshToken),
          accountId: input.accountId,
          tokenExpiresAt: input.tokenExpiresAt,
          connectedAt: now,
          updatedAt: now,
        },
      })
      .returning();
    return toPagBankSellerAccount(row!);
  },

  async remove(userId) {
    await db.delete(pagbankSellerAccounts).where(eq(pagbankSellerAccounts.userId, userId));
  },

  async listUserIds(): Promise<string[]> {
    const rows = await db
      .select({ userId: pagbankSellerAccounts.userId })
      .from(pagbankSellerAccounts);
    return rows.map((r) => r.userId);
  },
};
