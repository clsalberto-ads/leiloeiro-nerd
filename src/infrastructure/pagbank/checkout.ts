import { pagBankRequest } from "./client";

// ponytail: Checkout PagBank — o link de pagamento para CARTÃO (equivalente
// ao Checkout Pro da MP, mas com o split embutido na Order). O Checkout
// aceita PIX, cartão de crédito e débito.
//
// O retorno tem `checkout_url` que o arrematante abre no navegador; o
// PagBank processa o pagamento na página deles e notifica via webhook.

export interface CreateCheckoutInput {
  accessToken: string;
  amountCents: number;
  platformFeeCents: number;
  platformAccountId: string;
  sellerAccountId: string;
  description: string;
  payerEmail: string;
  referenceId: string;
  /** Para onde o PagBank redireciona APÓS o pagamento. */
  redirectUrl: string;
  notificationUrl: string;
  expiresAt: Date;
}

export interface PagBankCheckout {
  checkoutId: string;
  checkoutUrl: string;
}

interface CheckoutResponse {
  id?: string;
  links?: Array<{ href: string; rel: string }>;
}

export async function createPagBankCheckout(input: CreateCheckoutInput): Promise<PagBankCheckout> {
  const sellerNet = input.amountCents - input.platformFeeCents;

  const body = {
    reference_id: input.referenceId,
    redirect_url: input.redirectUrl,
    notification_url: input.notificationUrl,
    customer: { email: input.payerEmail },
    items: [
      {
        name: input.description.slice(0, 100),
        unit_price: input.amountCents,
        quantity: 1,
      },
    ],
    payment_methods: ["PIX", "CREDIT_CARD", "DEBIT_CARD"],
    additional_information: {
      split: [
        {
          account_id: input.platformAccountId,
          amount: { value: input.platformFeeCents },
          liable: true,
          charge_fee: true,
        },
        {
          account_id: input.sellerAccountId,
          amount: { value: sellerNet },
          liable: false,
          charge_fee: false,
        },
      ],
    },
  };

  const res = await pagBankRequest<CheckoutResponse>({
    path: "/checkouts",
    method: "POST",
    accessToken: input.accessToken,
    body,
  });

  const checkoutUrl = res.links?.find((l) => l.rel === "SELF")?.href ?? "";
  return {
    checkoutId: res.id ?? "",
    checkoutUrl,
  };
}
