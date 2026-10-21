import { pagBankRequest } from "./client";

// ponytail: criação de Order com QR Code PIX + split de 5% para a plataforma.
// O PagBank trabalha com ORDERS (não payments direto como a MP): a Order
// agrupa items, customer, QR codes e charges. O split é um ARRAY de receivers
// — cada um com account_id, valor e flags de responsabilidade.
//
// O split do PagBank é DIFERENTE do application_fee da MP: em vez de "a MP
// subtrai a taxa do pagamento", aqui a Order DEFINE quem recebe o quê:
//   receiver[0] = plataforma (5%)
//   receiver[1] = vendedor (95%)
// O "liable" marca quem responde pelo chargeback; "charge_fee" marca quem
// paga a taxa de processamento do PSP.

export interface CreatePixOrderInput {
  accessToken: string;
  /** Valor integral do arremate, em centavos. */
  amountCents: number;
  /** Taxa da plataforma (5%), em centavos — vai para o receiver da plataforma. */
  platformFeeCents: number;
  /** PagBank account_id da PLATAFORMA (quem recebe a taxa). */
  platformAccountId: string;
  /** PagBank account_id do VENDEDOR (quem recebe o líquido). */
  sellerAccountId: string;
  description: string;
  payerEmail: string;
  /** external_reference: amarra a Order ao NOSSO item. */
  referenceId: string;
  expiresAt: Date;
  /** URL que o PagBank chama quando o status muda. */
  notificationUrl: string;
}

export interface PagBankPixOrder {
  orderId: string;
  chargeId: string | null;
  /** Imagem do QR Code (base64 sem prefixo data:). */
  qrCodeBase64: string | null;
  /** Copia-e-cola do PIX. */
  qrCodeText: string | null;
  status: string;
}

interface PagBankOrderResponse {
  id?: string;
  status?: string;
  qr_codes?: Array<{
    text?: string;
    links?: Array<{ href: string; media_type: string; rel: string }>;
    amount?: { value?: number };
  }>;
  charges?: Array<{
    id?: string;
    status?: string;
  }>;
}

export async function createPixOrder(input: CreatePixOrderInput): Promise<PagBankPixOrder> {
  const [sellerNet, formattedAmount] = [
    input.amountCents - input.platformFeeCents,
    input.amountCents,
  ];

  const body = {
    reference_id: input.referenceId,
    notification_url: input.notificationUrl,
    customer: { email: input.payerEmail },
    items: [
      {
        name: input.description.slice(0, 100),
        unit_price: formattedAmount,
        quantity: 1,
      },
    ],
    qr_codes: [
      {
        amount: { value: formattedAmount },
      },
    ],
    // Split: plataforma recebe a taxa (5%), vendedor recebe o líquido (95%).
    // O PagBank aceita `split` como um array no nível do charge, mas para PIX
    // QR Code dinâmico, o split é configurado no receptor do QR code via
    // o `additional_information` do charge. A estrutura abaixo usa o formato
    // de `split` da API v2 do PagBank.
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

  const res = await pagBankRequest<PagBankOrderResponse>({
    path: "/orders",
    method: "POST",
    accessToken: input.accessToken,
    body,
  });

  const charge = res.charges?.[0];
  const qrCode = res.qr_codes?.[0];

  return {
    orderId: res.id ?? "",
    chargeId: charge?.id ?? null,
    qrCodeBase64: qrCode?.links?.find((l) => l.rel === "QRCODE")?.href ?? null,
    qrCodeText: qrCode?.text ?? null,
    status: charge?.status ?? res.status ?? "PENDING",
  };
}

/** Consulta uma Order por ID — retorna o status atualizado dos charges. */
export async function getPagBankOrder(
  accessToken: string,
  orderId: string,
): Promise<{ status: string; chargeStatus: string | null; referenceId: string | null }> {
  const res = await pagBankRequest<PagBankOrderResponse & { reference_id?: string }>({
    path: `/orders/${orderId}`,
    method: "GET",
    accessToken: input_token(accessToken),
  });
  return {
    status: res.status ?? "",
    chargeStatus: res.charges?.[0]?.status ?? null,
    referenceId: res.reference_id ?? null,
  };
}

function input_token(token: string): string {
  return token;
}
