import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { mpSellerAccounts } from "@/infrastructure/database/schema";
import type {
  MpSellerAccount,
  MpSellerAccountRepository,
  UpsertMpSellerAccountInput,
} from "@/domain/repositories/mp-seller-account-repository";

export type MpSellerAccountRow = typeof mpSellerAccounts.$inferSelect;

// ponytail: o mapper NÃO copia `accessToken` — nem "por engano". A entidade de
// domínio não tem o campo, e o teste dele (`drizzle-mp-seller-account-repository.test.ts`)
// é o que trava o dia em que alguém "só adiciona o campo que falta".
export function toMpSellerAccount(row: MpSellerAccountRow): MpSellerAccount {
  return {
    id: row.id,
    userId: row.userId,
    mpUserId: row.mpUserId,
    tokenExpiresAt: row.tokenExpiresAt,
    connectedAt: row.connectedAt,
  };
}

// Colunas seguras para a leitura de exibição: NÃO incluem access/refresh token.
const SAFE_COLUMNS = {
  id: mpSellerAccounts.id,
  userId: mpSellerAccounts.userId,
  mpUserId: mpSellerAccounts.mpUserId,
  tokenExpiresAt: mpSellerAccounts.tokenExpiresAt,
  connectedAt: mpSellerAccounts.connectedAt,
};

export const drizzleMpSellerAccountRepository: MpSellerAccountRepository = {
  async findByUserId(userId) {
    const [row] = await db
      .select(SAFE_COLUMNS)
      .from(mpSellerAccounts)
      .where(eq(mpSellerAccounts.userId, userId))
      .limit(1);
    return row ?? null;
  },

  async findCredentials(userId: string) {
    const [row] = await db
      .select({
        accessToken: mpSellerAccounts.accessToken,
        refreshToken: mpSellerAccounts.refreshToken,
        tokenExpiresAt: mpSellerAccounts.tokenExpiresAt,
      })
      .from(mpSellerAccounts)
      .where(eq(mpSellerAccounts.userId, userId))
      .limit(1);
    return row ?? null;
  },

  async upsert(input: UpsertMpSellerAccountInput) {
    // `onConflictDoUpdate` no userId: reconectar é SUBSTITUIR os tokens, não
    // criar uma segunda conta — e não "somar" tokens antigos com novos.
    const [row] = await db
      .insert(mpSellerAccounts)
      .values({
        userId: input.userId,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        mpUserId: input.mpUserId,
        tokenExpiresAt: input.tokenExpiresAt,
        connectedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: mpSellerAccounts.userId,
        set: {
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          mpUserId: input.mpUserId,
          tokenExpiresAt: input.tokenExpiresAt,
          connectedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    return toMpSellerAccount(row!);
  },

  async remove(userId) {
    await db.delete(mpSellerAccounts).where(eq(mpSellerAccounts.userId, userId));
  },
};
