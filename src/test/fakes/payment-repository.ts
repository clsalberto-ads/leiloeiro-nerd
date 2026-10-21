import type {
  CreatePaymentInput,
  Payment,
  PaymentRepository,
  PaymentStatus,
} from "@/domain/repositories/payment-repository";

// ponytail (R1.7): esta fake existia em TRÊS arquivos de teste, reescrita à
// mão — e as cópias JÁ tinham divergido (uma tinha `approveOnce`, outra
// não). Uma fonte única elimina a divergência e o custo de manter 90 linhas
// × 3. Quem precisa de comportamento especial (a corrida do webhook, por
// exemplo) usa os flags abaixo.
//
// A fake é INTELIGENTE de propósito: as transições são condicionais em
// `pending` (o mesmo invariante que o drizzle impõe no WHERE), os candidatos
// de cascata incluem `cancelled` (R6.2), e `findPendingByItemIds` devolve o
// MAIOR attemptNumber por item. Um teste que precisar de uma fake MENOS
// inteligente sobrepõe o método.
export class FakePaymentRepository implements PaymentRepository {
  payments: Payment[] = [];

  /** Simula a corrida de webhooks duplicados: só o primeiro markApproved vence. */
  approveOnce = false;
  private approvedOnce = false;

  async createPayment(input: CreatePaymentInput): Promise<Payment> {
    const payment: Payment = {
      id: `p${this.payments.length + 1}`,
      ...input,
      attemptNumber: input.attemptNumber ?? 1,
      status: "pending",
      reminderSentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.payments.push(payment);
    return payment;
  }

  async findById(id: string): Promise<Payment | null> {
    return this.payments.find((p) => p.id === id) ?? null;
  }

  async findByMpPaymentId(mpPaymentId: string): Promise<Payment | null> {
    return this.payments.find((p) => p.mpPaymentId === mpPaymentId) ?? null;
  }

  async findByItemId(itemId: string): Promise<Payment[]> {
    return this.payments.filter((p) => p.itemId === itemId);
  }

  async findByChainIndex(itemId: string, attemptNumber: number): Promise<Payment | null> {
    return this.payments.find((p) => p.itemId === itemId && p.attemptNumber === attemptNumber) ?? null;
  }

  async markCancelled(id: string): Promise<Payment | null> {
    return this.transition(id, "cancelled");
  }

  async markApproved(id: string): Promise<Payment | null> {
    if (this.approveOnce && this.approvedOnce) return null;
    const result = await this.transition(id, "approved");
    if (result) this.approvedOnce = true;
    return result;
  }

  async markExpired(id: string): Promise<Payment | null> {
    return this.transition(id, "expired");
  }

  private transition(id: string, status: PaymentStatus): Promise<Payment | null> {
    const p = this.payments.find((x) => x.id === id);
    if (!p || p.status !== "pending") return Promise.resolve(null);
    p.status = status;
    return Promise.resolve(p);
  }

  async findExpiredPending(now: Date): Promise<Payment[]> {
    return this.payments.filter((p) => p.status === "pending" && p.deadline <= now);
  }

  async findCascadeCandidates(): Promise<Payment[]> {
    return this.payments.filter((p) => p.status === "expired" || p.status === "cancelled");
  }

  async findPendingCreatedBefore(cutoff: Date): Promise<Payment[]> {
    return this.payments.filter((p) => p.status === "pending" && p.createdAt <= cutoff);
  }

  async findPendingReminderDue(windowStart: Date, windowEnd: Date): Promise<Payment[]> {
    return this.payments.filter(
      (p) =>
        p.status === "pending" &&
        p.reminderSentAt === null &&
        p.deadline >= windowStart &&
        p.deadline <= windowEnd,
    );
  }

  async markReminderSent(id: string, at: Date): Promise<Payment | null> {
    const p = this.payments.find((x) => x.id === id);
    if (!p || p.reminderSentAt !== null) return null;
    p.reminderSentAt = at;
    return p;
  }

  async setMpPaymentId(id: string, mpPaymentId: string): Promise<Payment | null> {
    const p = this.payments.find((x) => x.id === id);
    if (!p || p.status !== "pending") return null;
    p.mpPaymentId = mpPaymentId;
    return p;
  }

  async findPendingByItemIds(itemIds: string[]): Promise<Map<string, Payment>> {
    const map = new Map<string, Payment>();
    for (const p of this.payments) {
      if (p.status === "pending" && itemIds.includes(p.itemId)) {
        const existing = map.get(p.itemId);
        if (!existing || p.attemptNumber > existing.attemptNumber) {
          map.set(p.itemId, p);
        }
      }
    }
    return map;
  }
}
