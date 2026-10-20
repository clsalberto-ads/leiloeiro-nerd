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
  /**
   * As credenciais OAuth COMPLETAS, para o fluxo de pagamento (criar PIX,
   * renovar token). `null` = vendedor sem conta conectada.
   *
   * ponytail: o trio vem JUNTO porque a renovação precisa do `refreshToken`
   * quando o `accessToken` está perto de expirar — duas chamadas separadas
   * deixariam a janela de corrida "leu token, expirou, leu refresh" entre elas.
   * Continua SEM ir à UI: a separação `findByUserId` (estado) vs
   * `findCredentials` (segredo) é a mesma de antes.
   */
  findCredentials(
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string | null; tokenExpiresAt: Date | null } | null>;
  /** Conecta (ou reconecta) a conta: substitui os tokens de um `userId`. */
  upsert(input: UpsertMpSellerAccountInput): Promise<MpSellerAccount>;
  /** Desconecta: apaga a conta. Ausência = não conectado. */
  remove(userId: string): Promise<void>;
  /**
   * Ids de TODOS os vendedores com conta conectada — o resolvedor de webhooks
   * de CARTÃO (Checkout Pro) usa para descobrir de quem é o pagamento quando
   * o id não casa com nenhum PIX nosso (ver handle-payment-webhook).
   */
  listUserIds(): Promise<string[]>;
}
