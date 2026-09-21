export type PaymentStatus = "pending" | "approved" | "expired" | "cancelled" | "refunded";

export interface Payment {
  id: string;
  itemId: string;
  bidderId: string;
  bidId: string;
  amount: number;
  mpPaymentId: string | null;
  pixQrCode: string | null;
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
}