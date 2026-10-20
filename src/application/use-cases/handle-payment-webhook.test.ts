import { describe, expect, it, vi } from "vitest";
import { handlePaymentWebhook, type MpStatusFetcher } from "./handle-payment-webhook";
import type { Item, ItemRepository } from "@/domain/repositories/item-repository";
import type {
  CreatePaymentInput,
  Payment,
  PaymentRepository,
  PaymentStatus,
} from "@/domain/repositories/payment-repository";
import type { NotificationRepository, CreateNotificationInput } from "@/domain/repositories/notification-repository";

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "p1",
    itemId: "i1",
    bidderId: "bidder-1",
    bidId: "b1",
    amount: 10_000,
    platformFeeCents: 500,
    sellerNetCents: 9_500,
    mpPaymentId: "mp-123",
    pixQrCode: null,
    pixCopiaECola: null,
    paymentLink: null,
    status: "pending",
    deadline: new Date("2026-10-23T12:00:00Z"),
    attemptNumber: 1,
    createdAt: new Date("2026-10-20T12:00:00Z"),
    updatedAt: new Date("2026-10-20T12:00:00Z"),
    reminderSentAt: null,
    ...overrides,
  };
}

function makeItem(): Item {
  return {
    id: "i1",
    sellerId: "seller-1",
    title: "Console raro",
    description: "desc",
    type: "product",
    imageUrl: null,
    minInitialBid: 1000,
    minBidIncrement: 100,
    bidDeadline: new Date("2026-10-19T00:00:00Z"),
    paymentDeadlineDays: 3,
    cascadeDeadlineDays: null,
    status: "closed",
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-10-19T00:00:00Z"),
  };
}

class FakePaymentRepo implements PaymentRepository {
  payment: Payment | null;
  markedApproved: string[] = [];
  markedCancelled: string[] = [];
  // simula a corrida de webhooks duplicados: segunda transição devolve null
  approveOnce = false;
  approvedOnce = false;

  constructor(payment: Payment | null) {
    this.payment = payment;
  }
  // Anotação explícita: `implements` não fornece tipagem contextual, e um
  // `async createPayment() { throw }` solto seria inferido como Promise<void>.
  async createPayment(_input: CreatePaymentInput): Promise<Payment> {
    throw new Error("fora de escopo");
  }
  async findById(id: string) {
    return this.payment?.id === id ? this.payment : null;
  }
  async findByMpPaymentId(mpPaymentId: string) {
    return this.payment?.mpPaymentId === mpPaymentId ? this.payment : null;
  }
  async findByItemId(itemId: string) {
    return this.payment?.itemId === itemId ? [this.payment] : [];
  }
  async findByChainIndex() {
    return null;
  }
  async markCancelled(id: string) {
    if (this.payment?.id !== id) return null;
    if (this.payment.status !== "pending") return null;
    this.markedCancelled.push(id);
    this.payment = { ...this.payment, status: "cancelled" };
    return this.payment;
  }
  async markApproved(id: string) {
    if (this.payment?.id !== id) return null;
    if (this.payment.status !== "pending") return null;
    if (this.approveOnce && this.approvedOnce) return null;
    this.approvedOnce = true;
    this.markedApproved.push(id);
    this.payment = { ...this.payment, status: "approved" };
    return this.payment;
  }
  async markExpired(id: string) {
    if (this.payment?.id !== id) return null;
    if (this.payment.status !== "pending") return null;
    this.payment = { ...this.payment, status: "expired" };
    return this.payment;
  }
  async findExpiredPending(now: Date) {
    return this.payment && this.payment.status === "pending" && this.payment.deadline <= now
      ? [this.payment]
      : [];
  }
  async findCascadeCandidates() {
    return this.payment && (this.payment.status === "expired" || this.payment.status === "cancelled")
      ? [this.payment]
      : [];
  }
  async findPendingReminderDue(windowStart: Date, windowEnd: Date) {
    if (
      this.payment &&
      this.payment.status === "pending" &&
      this.payment.reminderSentAt === null &&
      this.payment.deadline >= windowStart &&
      this.payment.deadline <= windowEnd
    ) {
      return [this.payment];
    }
    return [];
  }
  async markReminderSent(id: string, at: Date) {
    if (this.payment?.id !== id || this.payment.reminderSentAt !== null) return null;
    this.payment = { ...this.payment, reminderSentAt: at };
    return this.payment;
  }
  async findPendingCreatedBefore(cutoff: Date) {
    return this.payment && this.payment.status === "pending" && this.payment.createdAt <= cutoff
      ? [this.payment]
      : [];
  }
}

class FakeItemRepo implements Pick<ItemRepository, "findById" | "setStatus"> {
  item: Item;
  statuses: Array<{ id: string; status: Item["status"] }> = [];
  constructor(item: Item) {
    this.item = item;
  }
  async findById(id: string) {
    return this.item.id === id ? this.item : null;
  }
  async setStatus(id: string, status: Item["status"]) {
    this.statuses.push({ id, status });
    this.item = { ...this.item, status };
    return this.item;
  }
}

class FakeNotifRepo implements NotificationRepository {
  notifications: CreateNotificationInput[] = [];
  fail = false;
  async create(input: CreateNotificationInput) {
    if (this.fail) throw new Error("caiu");
    this.notifications.push(input);
    return { id: "n1", ...input, read: false, createdAt: new Date() };
  }
  async getUnreadCount() {
    return 0;
  }
  async listRecent() {
    return [];
  }
  async listByUser() {
    return { items: [], total: 0 };
  }
  async countByUser() {
    return 0;
  }
  async markAsRead() {}
  async markAllAsRead() {}
  async markManyAsRead() {}
  async delete() {}
}

function makeDeps(overrides: {
  payment?: Payment | null;
  mpStatus?: string;
  approveOnce?: boolean;
  notifFail?: boolean;
} = {}) {
  const paymentRepo = new FakePaymentRepo(overrides.payment ?? makePayment());
  paymentRepo.approveOnce = overrides.approveOnce ?? false;
  const itemRepo = new FakeItemRepo(makeItem());
  const notifRepo = new FakeNotifRepo();
  notifRepo.fail = overrides.notifFail ?? false;
  const fetchStatus: MpStatusFetcher = {
    async fetchMpPaymentStatus() {
      return { status: overrides.mpStatus ?? "approved", statusDetail: "accredited" };
    },
  };
  const getAccessToken = vi.fn(async () => "APP_USR-vendedor");
  const userRepo = {
    async findByIds(ids: string[]) {
      return ids
        .map((id) =>
          id === "bidder-1"
            ? {
                id,
                name: "Ana",
                email: "ana@exemplo.test",
                phone: null,
                slug: null,
                address: null,
                role: "bidder" as const,
              }
            : undefined,
        )
        .filter((u): u is NonNullable<typeof u> => Boolean(u));
    },
  };

  const deps = {
    paymentRepo,
    itemRepo,
    notifRepo,
    getAccessToken,
    fetchStatus,
    userRepo,
  };
  return { deps, paymentRepo, itemRepo, notifRepo, getAccessToken, fetchStatus, userRepo };
}

describe("handlePaymentWebhook", () => {
  it("aprova: pagamento approved + item paid + notificação payment_confirmed", async () => {
    const ctx = makeDeps({ mpStatus: "approved" });

    const outcome = await handlePaymentWebhook(ctx.deps, "mp-123");

    expect(outcome).toMatchObject({ result: "approved" });
    expect(ctx.itemRepo.statuses).toEqual([{ id: "i1", status: "paid" }]);
    expect(ctx.notifRepo.notifications[0]).toMatchObject({
      userId: "bidder-1",
      type: "payment_confirmed",
    });
  });

  it("webhook duplicado (transição já feita) é IGNORED sem notificar de novo", async () => {
    // `approveOnce` simula dois webhooks concorrendo: o primeiro aprova, o
    // segundo recebe null do UPDATE condicional
    const ctx = makeDeps({ mpStatus: "approved", approveOnce: true });

    const first = await handlePaymentWebhook(ctx.deps, "mp-123");
    const second = await handlePaymentWebhook(ctx.deps, "mp-123");

    expect(first).toMatchObject({ result: "approved" });
    expect(second).toMatchObject({ result: "ignored", reason: "not-pending" });
    expect(ctx.notifRepo.notifications).toHaveLength(1);
  });

  it("pagamento já finalizado não consulta a MP nem notifica", async () => {
    const ctx = makeDeps({
      payment: makePayment({ status: "approved" as PaymentStatus }),
    });

    const outcome = await handlePaymentWebhook(ctx.deps, "mp-123");

    expect(outcome).toMatchObject({ result: "ignored", reason: "not-pending" });
    expect(ctx.getAccessToken).not.toHaveBeenCalled();
    expect(ctx.notifRepo.notifications).toHaveLength(0);
  });

  it("id da MP que não conhecemos é ignorado (webhook de outra loja)", async () => {
    const ctx = makeDeps({ payment: null });

    expect(await handlePaymentWebhook(ctx.deps, "mp-desconhecido")).toMatchObject({
      result: "ignored",
      reason: "payment-not-found",
    });
  });

  it("rejected/cancelled da MP sincroniza o status local — SEM cascata e SEM item paid", async () => {
    const ctx = makeDeps({ mpStatus: "cancelled" });

    const outcome = await handlePaymentWebhook(ctx.deps, "mp-123");

    expect(outcome).toMatchObject({ result: "cancelled" });
    expect(ctx.itemRepo.statuses).toEqual([]); // item continua closed: cascata é do cron
  });

  it("status intermediário (pending/in_process) é 200-silêncio: nada muda", async () => {
    const ctx = makeDeps({ mpStatus: "in_process" });

    expect(await handlePaymentWebhook(ctx.deps, "mp-123")).toMatchObject({
      result: "ignored",
      reason: "status-unchanged",
    });
    expect(ctx.paymentRepo.markedApproved).toHaveLength(0);
    expect(ctx.itemRepo.statuses).toEqual([]);
  });

  it("falha na consulta à MP sobe (o 500 faz a MP reenviar depois)", async () => {
    const ctx = makeDeps();
    ctx.fetchStatus.fetchMpPaymentStatus = async () => {
      throw new Error("MP fora do ar");
    };

    await expect(handlePaymentWebhook(ctx.deps, "mp-123")).rejects.toThrow("MP fora do ar");
  });

  it("falha na notificação não desfaz a aprovação (best-effort)", async () => {
    const ctx = makeDeps({ mpStatus: "approved", notifFail: true });

    const outcome = await handlePaymentWebhook(ctx.deps, "mp-123");

    expect(outcome).toMatchObject({ result: "approved" });
    expect(ctx.itemRepo.statuses).toEqual([{ id: "i1", status: "paid" }]);
  });
});

// ponytail: o e-mail `payment_confirmed` é best-effort e OPCIONAL nas deps —
// estes testes travam que ele É enviado quando o cliente existe, e que a
// ausência dele não muda NADA no fluxo de aprovação.
describe("handlePaymentWebhook — e-mail payment_confirmed", () => {
  function fakeResend() {
    const sent: Array<{ to: string; subject: string; html: string }> = [];
    return {
      sent,
      emails: {
        send: async (args: { to: string; subject: string; html: string }) => {
          sent.push(args);
          return { data: { id: "email-1" }, error: null };
        },
      },
    };
  }

  it("aprovado com resend configurado envia o e-mail de confirmação", async () => {
    const ctx = makeDeps({ mpStatus: "approved" });
    const resend = fakeResend();

    await handlePaymentWebhook(
      { ...ctx.deps, resend, userRepo: ctx.deps.userRepo },
      "mp-123",
    );

    expect(resend.sent).toHaveLength(1);
    expect(resend.sent[0]).toMatchObject({ to: "ana@exemplo.test", subject: "Pagamento confirmado!" });
    expect(resend.sent[0]!.html).toContain("Console raro");
    expect(resend.sent[0]!.html).toContain("R$ 100,00");
  });

  it("sem resend o fluxo aprova exatamente igual (e-mail é opcional)", async () => {
    const ctx = makeDeps({ mpStatus: "approved" });

    const outcome = await handlePaymentWebhook(ctx.deps, "mp-123");

    expect(outcome).toMatchObject({ result: "approved" });
    expect(ctx.itemRepo.statuses).toEqual([{ id: "i1", status: "paid" }]);
  });
});
