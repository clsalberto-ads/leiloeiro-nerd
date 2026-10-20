import { describe, expect, it, vi } from "vitest";
import { createPayment, type MpPaymentClient } from "./create-payment";
import type { Bid, BidPlacement, BidRepository } from "@/domain/repositories/bid-repository";
import type { Item, ItemRepository, ItemStatus } from "@/domain/repositories/item-repository";
import type {
  Payment,
  PaymentRepository,
  CreatePaymentInput,
} from "@/domain/repositories/payment-repository";
import type { UserRepository, UserProfile } from "@/domain/repositories/user-repository";
import type {
  NotificationRepository,
  CreateNotificationInput,
} from "@/domain/repositories/notification-repository";

const NOW = new Date("2026-10-20T12:00:00Z");

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "i1",
    sellerId: "seller1",
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
    ...overrides,
  };
}

function makeBid(overrides: Partial<Bid> = {}): Bid {
  return {
    id: "b1",
    itemId: "i1",
    bidderId: "bidder1",
    bidderName: "Ana",
    amount: 10_000,
    rank: 1,
    createdAt: new Date("2026-10-18T00:00:00Z"),
    ...overrides,
  };
}

class FakeItemRepo implements Pick<ItemRepository, "findById"> {
  items = new Map<string, Item>();
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
}

class FakeBidRepo implements BidRepository {
  bids: Bid[] = [];
  async findByItemId(itemId: string) {
    // ordenado por amount DESC, como o contrato pede — o rank 1 é o primeiro
    return this.bids.filter((b) => b.itemId === itemId).sort((a, b) => b.amount - a.amount);
  }
  async placeBid(): Promise<BidPlacement> {
    // fora de escopo aqui: o create-payment só LÊ lances
    throw new Error("fora de escopo");
  }
  async listByBidder() {
    return [];
  }
}

class FakePaymentRepo implements PaymentRepository {
  created: CreatePaymentInput[] = [];
  private payments: Payment[] = [];
  async createPayment(input: CreatePaymentInput): Promise<Payment> {
    this.created.push(input);
    const payment: Payment = {
      id: `p${this.payments.length + 1}`,
      ...input,
      attemptNumber: input.attemptNumber ?? 1,
      status: "pending",
      createdAt: NOW,
      updatedAt: NOW,
      reminderSentAt: null,
    };
    this.payments.push(payment);
    return payment;
  }
  async findById(id: string) {
    return this.payments.find((p) => p.id === id) ?? null;
  }
  async findByMpPaymentId(mpPaymentId: string) {
    return this.payments.find((p) => p.mpPaymentId === mpPaymentId) ?? null;
  }
  async findByItemId(itemId: string) {
    return this.payments.filter((p) => p.itemId === itemId);
  }
  async findByChainIndex(itemId: string, attemptNumber: number) {
    return this.payments.find((p) => p.itemId === itemId && p.attemptNumber === attemptNumber) ?? null;
  }
  async markCancelled(id: string) {
    const p = this.payments.find((x) => x.id === id);
    if (!p) return null;
    p.status = "cancelled";
    return p;
  }
  async markApproved(id: string) {
    const p = this.payments.find((x) => x.id === id);
    if (!p || p.status !== "pending") return null;
    p.status = "approved";
    return p;
  }
  async markExpired(id: string) {
    const p = this.payments.find((x) => x.id === id);
    if (!p || p.status !== "pending") return null;
    p.status = "expired";
    return p;
  }
  async findExpiredPending(now: Date) {
    return this.payments.filter((p) => p.status === "pending" && p.deadline <= now);
  }
  async findCascadeCandidates() {
    return this.payments.filter((p) => p.status === "expired" || p.status === "cancelled");
  }
  async findPendingReminderDue(windowStart: Date, windowEnd: Date) {
    return this.payments.filter(
      (p) =>
        p.status === "pending" &&
        p.reminderSentAt === null &&
        p.deadline >= windowStart &&
        p.deadline <= windowEnd,
    );
  }
  async markReminderSent(id: string, at: Date) {
    const p = this.payments.find((x) => x.id === id);
    if (!p || p.reminderSentAt !== null) return null;
    p.reminderSentAt = at;
    return p;
  }
  async findPendingCreatedBefore(cutoff: Date) {
    return this.payments.filter((p) => p.status === "pending" && p.createdAt <= cutoff);
  }
}

class FakeUserRepo implements Pick<UserRepository, "findByIds"> {
  users = new Map<string, UserProfile>();
  async findByIds(ids: string[]) {
    return ids.map((id) => this.users.get(id)).filter((u): u is UserProfile => Boolean(u));
  }
}

class FakeNotifRepo implements NotificationRepository {
  notifications: CreateNotificationInput[] = [];
  fail = false;
  async create(input: CreateNotificationInput) {
    if (this.fail) throw new Error("notificação caiu");
    this.notifications.push(input);
    return {
      id: "n1",
      ...input,
      read: false,
      createdAt: NOW,
    };
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

function makeMpClient(): MpPaymentClient & { calls: Array<Record<string, unknown>> } {
  const calls: Array<Record<string, unknown>> = [];
  return {
    calls,
    async createPixPayment(input) {
      calls.push(input as unknown as Record<string, unknown>);
      return {
        mpPaymentId: "mp-123",
        qrCodeBase64: "data:image/png;base64,QR",
        qrCopiaECola: "00020126PIX",
      };
    },
  };
}

function makeDeps(overrides: {
  item?: Item | null;
  bids?: Bid[];
  token?: string;
  users?: UserProfile[];
  notifFail?: boolean;
} = {}) {
  const itemRepo = new FakeItemRepo();
  if (overrides.item !== null) itemRepo.items.set("i1", overrides.item ?? makeItem());
  const bidRepo = new FakeBidRepo();
  bidRepo.bids = overrides.bids ?? [makeBid()];
  const paymentRepo = new FakePaymentRepo();
  const userRepo = new FakeUserRepo();
  // `users: []` LIMPA o mapa de propósito — é o caso "arrematante sem e-mail".
  const defaultUsers: UserProfile[] = [
    {
      id: "bidder1",
      name: "Ana",
      email: "ana@exemplo.test",
      phone: null,
      slug: null,
      address: null,
      role: "bidder",
    },
    {
      id: "bidder2",
      name: "Bia",
      email: "bia@exemplo.test",
      phone: null,
      slug: null,
      address: null,
      role: "bidder",
    },
  ];
  for (const u of overrides.users ?? defaultUsers) userRepo.users.set(u.id, u);
  const notifRepo = new FakeNotifRepo();
  notifRepo.fail = overrides.notifFail ?? false;
  const mpClient = makeMpClient();
  const getAccessToken = vi.fn(async () => overrides.token ?? "APP_USR-vendedor");

  return {
    deps: {
      itemRepo,
      bidRepo,
      paymentRepo,
      userRepo,
      notifRepo,
      mpClient,
      getAccessToken,
    },
    itemRepo,
    bidRepo,
    paymentRepo,
    notifRepo,
    mpClient,
    getAccessToken,
  };
}

describe("createPayment", () => {
  it("gera PIX na conta do vendedor retendo 5% (application_fee) e grava o ledger", async () => {
    const ctx = makeDeps();

    const payment = await createPayment(ctx.deps, "i1", NOW);

    // A taxa é o coração do requisito: R$ 100,00 → R$ 5,00 da plataforma
    expect(ctx.mpClient.calls[0]).toMatchObject({
      accessToken: "APP_USR-vendedor",
      amountCents: 10_000,
      feeCents: 500,
      description: "Arremate: Console raro",
      payerEmail: "ana@exemplo.test",
    });
    expect(ctx.paymentRepo.created[0]).toMatchObject({
      amount: 10_000,
      platformFeeCents: 500,
      sellerNetCents: 9_500,
      mpPaymentId: "mp-123",
      pixQrCode: "data:image/png;base64,QR",
      pixCopiaECola: "00020126PIX",
      attemptNumber: 1,
      bidderId: "bidder1",
      bidId: "b1",
    });
    // prazo de pagamento: 3 dias (paymentDeadlineDays do item)
    expect(payment.deadline.toISOString()).toBe("2026-10-23T12:00:00.000Z");
  });

  it("é idempotente: pagamento existente na tentativa 1 é devolvido SEM chamar a MP", async () => {
    const ctx = makeDeps();
    const existing = await createPayment(ctx.deps, "i1", NOW);
    const mpCallsBefore = ctx.mpClient.calls.length;
    const tokenCallsBefore = ctx.getAccessToken.mock.calls.length;

    const again = await createPayment(ctx.deps, "i1", NOW);

    expect(again.id).toBe(existing.id);
    expect(ctx.mpClient.calls).toHaveLength(mpCallsBefore);
    expect(ctx.getAccessToken.mock.calls).toHaveLength(tokenCallsBefore);
  });

  it("o vencedor é o maior lance (rank 1), não o último", async () => {
    const ctx = makeDeps({
      bids: [
        makeBid({ id: "b1", bidderId: "bidder1", amount: 5_000 }),
        makeBid({ id: "b2", bidderId: "bidder2", amount: 12_000 }),
      ],
    });

    const payment = await createPayment(ctx.deps, "i1", NOW);

    expect(payment.bidId).toBe("b2");
    expect(payment.amount).toBe(12_000);
    expect(payment.platformFeeCents).toBe(600);
    expect(payment.sellerNetCents).toBe(11_400);
  });

  it("recusa item que não existe, não está encerrado ou não tem lances", async () => {
    await expect(createPayment(makeDeps({ item: null }).deps, "i1", NOW)).rejects.toThrow(
      "Item não encontrado",
    );
    await expect(
      createPayment(makeDeps({ item: makeItem({ status: "active" as ItemStatus }) }).deps, "i1", NOW),
    ).rejects.toThrow("encerrado");
    await expect(createPayment(makeDeps({ bids: [] }).deps, "i1", NOW)).rejects.toThrow(
      "sem lances",
    );
  });

  it("vendedor sem conta Mercado Pago conectada é erro claro (o token provider sobe)", async () => {
    const ctx = makeDeps();
    ctx.getAccessToken.mockRejectedValue(new Error("Vendedor sem conta Mercado Pago conectada"));

    await expect(createPayment(ctx.deps, "i1", NOW)).rejects.toThrow("conta Mercado Pago");
    expect(ctx.mpClient.calls).toHaveLength(0);
  });

  it("notifica o vencedor (tipo won) — best-effort: falha na notificação não derruba o pagamento", async () => {
    const ok = makeDeps();
    await createPayment(ok.deps, "i1", NOW);
    expect(ok.notifRepo.notifications).toHaveLength(1);
    expect(ok.notifRepo.notifications[0]).toMatchObject({ userId: "bidder1", type: "won" });

    const failing = makeDeps({ notifFail: true });
    const stillCreated = await createPayment(failing.deps, "i1", NOW);
    expect(stillCreated.mpPaymentId).toBe("mp-123");
    expect(failing.paymentRepo.created).toHaveLength(1);
  });

  it("arrematante sem e-mail para a cobrança é erro antes de chamar a MP", async () => {
    const ctx = makeDeps({ users: [] });

    await expect(createPayment(ctx.deps, "i1", NOW)).rejects.toThrow("e-mail");
    expect(ctx.mpClient.calls).toHaveLength(0);
  });
});
