import { eq } from "drizzle-orm";
import { decryptToken, encryptToken } from "@/infrastructure/mercado-pago/token-cipher";
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
    if (!row) return null;
    // ponytail: a cifra mora NO REPOSITÓRIO — o domínio e os use cases seguem
    // vendo o token limpo; para eles nada mudou. O refresh junto porque ele
    // fabrica tokens NOVOS (vale tanto quanto o access).
    return {
      accessToken: decryptToken(row.accessToken),
      refreshToken: row.refreshToken === null ? null : decryptToken(row.refreshToken),
      tokenExpiresAt: row.tokenExpiresAt,
    };
  },

  async upsert(input: UpsertMpSellerAccountInput) {
    // `onConflictDoUpdate` no userId: reconectar é SUBSTITUIR os tokens, não
    // criar uma segunda conta — e não "somar" tokens antigos com novos.
    const [row] = await db
      .insert(mpSellerAccounts)
      .values({
        userId: input.userId,
        accessToken: encryptToken(input.accessToken),
        refreshToken: input.refreshToken === null ? null : encryptToken(input.refreshToken),
        mpUserId: input.mpUserId,
        tokenExpiresAt: input.tokenExpiresAt,
        connectedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: mpSellerAccounts.userId,
        set: {
          accessToken: encryptToken(input.accessToken),
          refreshToken: input.refreshToken === null ? null : encryptToken(input.refreshToken),
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
