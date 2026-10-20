// ponytail: o cliente de PAGAMENTOS do Mercado Pago (modelo marketplace).
// Toda chamada aqui usa o ACCESS TOKEN DO VENDEDOR (OAuth) — é o que faz o
// dinheiro cair na conta dele — e carrega o `application_fee` (a taxa de 5%
// da plataforma) no próprio pagamento: o split é feito pela MP, não por nós.
//
// PIX via API de Payments (`payment_method_id: "pix"`) devolve o
// copia-e-cola (`qr_data`) e a imagem do QR (`qr_code_base64`) na mesma
// resposta — sem segunda chamada. O `date_of_expiration` alinha a validade do
// PIX com o NOSSO deadline: a própria MP expira a cobrança quando ele passa,
// e o webhook `payment.expired` chega para a sincronização (Fase D/E).
const MP_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";

export interface CreatePixInput {
  accessToken: string;
  /** Valor integral do arremate, em centavos. */
  amountCents: number;
  /** Taxa da plataforma, em centavos — o `application_fee` do marketplace. */
  feeCents: number;
  description: string;
  payerEmail: string;
  expiresAt: Date;
  /** Referência externa: amarra o pagamento da MP ao item no nosso banco. */
  externalReference: string;
}

export interface MpPixPayment {
  mpPaymentId: string;
  /** Imagem do QR Code (data URL base64) — `qr_code_base64` da MP. */
  qrCodeBase64: string | null;
  /** Copia-e-cola — `qr_code` da MP. */
  qrCopiaECola: string | null;
  status: string;
}

// ponytail: centavos → reais em UMA função. A API da MP fala BRL decimal
// (`transaction_amount: 100.00`), e o projeto fala centavos — esta é a ÚNICA
// ponte entre os dois, para o 9,99 nunca virar 9.98 por um arredondamento
// duplicado em dois lugares diferentes.
function toReais(cents: number): number {
  return cents / 100;
}

async function mpRequest(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(`${MP_PAYMENTS_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Mercado Pago recusou a chamada (HTTP ${res.status}): ${detail.slice(0, 300)}`,
    );
  }
  return res.json();
}

/** Cria um PIX na conta do vendedor, com a taxa da plataforma retida. */
export async function createMpPixPayment(input: CreatePixInput): Promise<MpPixPayment> {
  const body = {
    transaction_amount: toReais(input.amountCents),
    description: input.description,
    payment_method_id: "pix",
    payer: { email: input.payerEmail },
    application_fee: toReais(input.feeCents),
    external_reference: input.externalReference,
    date_of_expiration: input.expiresAt.toISOString(),
  };

  const raw = (await mpRequest("", input.accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  })) as {
    id?: unknown;
    status?: unknown;
    point_of_interaction?: {
      transaction_data?: { qr_code?: unknown; qr_code_base64?: unknown };
    };
  };

  if (typeof raw.id !== "number" && typeof raw.id !== "string") {
    throw new Error("Mercado Pago não devolveu o id do pagamento");
  }

  const tx = raw.point_of_interaction?.transaction_data;
  return {
    mpPaymentId: String(raw.id),
    qrCopiaECola: typeof tx?.qr_code === "string" ? tx.qr_code : null,
    qrCodeBase64:
      typeof tx?.qr_code_base64 === "string"
        ? `data:image/png;base64,${tx.qr_code_base64}`
        : null,
    status: typeof raw.status === "string" ? raw.status : "pending",
  };
}

/** Consulta um pagamento na conta do vendedor (sincronização/webhook). */
export async function getMpPayment(
  accessToken: string,
  mpPaymentId: string,
): Promise<{ status: string; statusDetail: string | null; externalReference: string | null }> {
  const raw = (await mpRequest(`/${mpPaymentId}`, accessToken)) as {
    status?: unknown;
    status_detail?: unknown;
    external_reference?: unknown;
  };
  return {
    status: typeof raw.status === "string" ? raw.status : "",
    statusDetail: typeof raw.status_detail === "string" ? raw.status_detail : null,
    externalReference: typeof raw.external_reference === "string" ? raw.external_reference : null,
  };
}

// ponytail (R6.1): Checkout Pro — o LINK de pagamento que habilita CARTÃO
// (e os cartões de teste da matriz). Preferência com `application_fee` = a
// MESMA taxa de 5% da plataforma no split da MP; `external_reference` amarra
// o pagamento resultante ao NOSSO item (é o que o webhook usa quando o id do
// pagamento NÃO é um PIX nosso — ver o resolvedor em handle-payment-webhook).
const MP_PREFERENCES_URL = "https://api.mercadopago.com/checkout/preferences";

export interface CreatePreferenceInput {
  accessToken: string;
  title: string;
  /** Valor integral do arremate, em centavos. */
  amountCents: number;
  /** Taxa da plataforma, em centavos — o `application_fee` da preferência. */
  feeCents: number;
  payerEmail: string;
  externalReference: string;
  expiresAt: Date;
}

export interface MpCheckoutPreference {
  preferenceId: string;
  /** A URL que abre o checkout da MP (aba nova). */
  initPoint: string;
}

export async function createMpCheckoutPreference(
  input: CreatePreferenceInput,
): Promise<MpCheckoutPreference> {
  const res = await fetch(MP_PREFERENCES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      items: [
        {
          title: input.title,
          quantity: 1,
          unit_price: toReais(input.amountCents),
          currency_id: "BRL",
        },
      ],
      application_fee: toReais(input.feeCents),
      external_reference: input.externalReference,
      payer: { email: input.payerEmail },
      expiration_date: input.expiresAt.toISOString(),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Mercado Pago recusou a preferência (HTTP ${res.status}): ${detail.slice(0, 300)}`,
    );
  }
  const raw = (await res.json()) as { id?: unknown; init_point?: unknown };
  if (typeof raw.id !== "string" || typeof raw.init_point !== "string") {
    throw new Error("Mercado Pago não devolveu a preferência do checkout");
  }
  return { preferenceId: raw.id, initPoint: raw.init_point };
}
