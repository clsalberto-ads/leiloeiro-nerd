// ponytail: a conta Mercado Pago do LEILOEIRO, conectada via OAuth
// (marketplace). O contrato separa DE PROPÓSITO as duas leituras:
//
//   `findByUserId`  → o que a UI mostra ("conectado desde..."). SEM token.
//   `findAccessToken` → o que o fluxo de pagamento usa para criar o PIX.
//
// Se fosse um método só, o caminho fácil seria devolver a entidade inteira —
// e o token de produção apareceria em qualquer `findByUserId` que a tela de
// configurações chamasse, sem nenhum erro de tipo acusar. A porta separada
// faz o vazamento exigir um método NOVO, que aparece no diff.
export interface MpSellerAccount {
  id: string;
  userId: string;
  /** Id da conta MP do vendedor (claim `user_id` do OAuth). Informativo. */
  mpUserId: string | null;
  /** Expiração do access token (~180 dias); renovação via `refreshToken`. */
  tokenExpiresAt: Date | null;
  connectedAt: Date;
}

export interface UpsertMpSellerAccountInput {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  mpUserId: string | null;
  tokenExpiresAt: Date | null;
}

export interface MpSellerAccountRepository {
  /** A conta do vendedor, SEM o token — uso da UI e de checagens de estado. */
  findByUserId(userId: string): Promise<MpSellerAccount | null>;
  /** O token de acesso, para o fluxo de pagamento. `null` = não conectado. */
  findAccessToken(userId: string): Promise<string | null>;
  /** Conecta (ou reconecta) a conta: substitui os tokens de um `userId`. */
  upsert(input: UpsertMpSellerAccountInput): Promise<MpSellerAccount>;
  /** Desconecta: apaga a conta. Ausência = não conectado. */
  remove(userId: string): Promise<void>;
}
