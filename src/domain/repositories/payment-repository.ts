export type PaymentStatus = "pending" | "approved" | "expired" | "cancelled" | "refunded";

export interface Payment {
  id: string;
  itemId: string;
  bidderId: string;
  bidId: string;
  amount: number;
  // ponytail: o LEDGER da taxa de marketplace (5%). Vem junto do `amount`
  // porque os KPIs e a página de pagamento leem os três — e a soma
  // `sellerNetCents + platformFeeCents === amount` é o invariante que o
  // `splitPayment` (@/lib/platform-fee) garante na criação.
  platformFeeCents: number;
  sellerNetCents: number;
  mpPaymentId: string | null;
  /** Imagem do QR Code PIX (ex.: data URL base64 do MP `qr_code_base64`). */
  pixQrCode: string | null;
  /** Payload copia-e-cola (MP `qr_code`). */
  pixCopiaECola: string | null;
  paymentLink: string | null;
  status: PaymentStatus;
  deadline: Date;
  attemptNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentInput {
  itemId: string;
  bidderId: string;
  bidId: string;
  amount: number;
  platformFeeCents: number;
  sellerNetCents: number;
  mpPaymentId: string | null;
  pixQrCode: string | null;
  pixCopiaECola: string | null;
  paymentLink: string | null;
  deadline: Date;
  attemptNumber?: number;
}

export interface PaymentRepository {
  createPayment(input: CreatePaymentInput): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  findByItemId(itemId: string): Promise<Payment[]>;
  findByChainIndex(itemId: string, attemptNumber: number): Promise<Payment | null>;
  markCancelled(id: string): Promise<Payment | null>;
}