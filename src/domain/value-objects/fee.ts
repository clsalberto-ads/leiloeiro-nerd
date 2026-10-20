// ponytail: A TAXA DE MARKETPLACE. 5% de todo pagamento de arremate — o que a
// plataforma retém (via `application_fee` do Mercado Pago) e o que o vendedor
// recebe líquido. Toda a Fase de pagamentos lê ESTE número daqui; nenhum outro
// arquivo reescreve 0.05.
//
// O valor é em CENTAVOS (o contrato de dinheiro do projeto), e o arredondamento
// é `Math.round` no centavo — R$ 1,00 → taxa R$ 0,05; R$ 9,99 → taxa R$ 0,50
// (49,95 arredonda para 50). A soma `net + fee` devolve SEMPRE o valor integral,
// que é o que o LEDGER (`payments.platform_fee_cents`/`seller_net_cents`) promete.
export const PLATFORM_FEE_PERCENT = 0.05;

export interface PaymentSplit {
  /** O que a plataforma retém, em centavos. */
  platformFeeCents: number;
  /** O que o vendedor recebe líquido, em centavos. */
  sellerNetCents: number;
}

export function calculateFeeCents(amountCents: number): number {
  return Math.round(amountCents * PLATFORM_FEE_PERCENT);
}

export function splitPayment(amountCents: number): PaymentSplit {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("Valor de pagamento inválido para a divisão da taxa");
  }
  const platformFeeCents = calculateFeeCents(amountCents);
  return {
    platformFeeCents,
    sellerNetCents: amountCents - platformFeeCents,
  };
}
