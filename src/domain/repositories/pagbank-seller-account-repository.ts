// ponytail: a conta PagBank do LEILOEIRO, conectada via Connect (OAuth).
// Mesma separação de portas do MP: findByUserId (sem token, para UI) vs
// findCredentials (token + accountId, para o fluxo de pagamento).
export interface PagBankSellerAccount {
  id: string;
  userId: string;
  accountId: string | null;
  tokenExpiresAt: Date | null;
  connectedAt: Date;
}

export interface UpsertPagBankSellerAccountInput {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  accountId: string | null;
  tokenExpiresAt: Date | null;
}

export interface PagBankSellerAccountRepository {
  findByUserId(userId: string): Promise<PagBankSellerAccount | null>;
  findCredentials(userId: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
    accountId: string | null;
    tokenExpiresAt: Date | null;
  } | null>;
  upsert(input: UpsertPagBankSellerAccountInput): Promise<PagBankSellerAccount>;
  remove(userId: string): Promise<void>;
  listUserIds(): Promise<string[]>;
}
