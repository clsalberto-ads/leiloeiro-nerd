import { describe, expect, it, vi } from "vitest";
import { verificarPrazos, sincronizarMp, DEFAULT_CASCADE_DAYS } from "./verificar-prazos";
import { createPayment, type MpPaymentClient } from "./create-payment";
import type { Bid, BidPlacement, BidRepository } from "@/domain/repositories/bid-repository";
import type { Item, ItemRepository } from "@/domain/repositories/item-repository";
import type {
  CreatePaymentInput,
  Payment,
  PaymentRepository,
  PaymentStatus,
} from "@/domain/repositories/payment-repository";
import type { UserRepository, UserProfile } from "@/domain/repositories/user-repository";
import type { NotificationRepository, CreateNotificationInput } from "@/domain/repositories/notification-repository";

const NOW = new Date("2026-10-20T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function makeItem(overrides: Partial<Item> = {}): Item {
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
    ...overrides,
  };
}

function makeBid(overrides: Partial<Bid> = {}): Bid {
  return {
    id: "b1",
    itemId: "i1",
    bidderId: "bidder-1",
    bidderName: "Ana",
    amount: 10_000,
    rank: 1,
    createdAt: new Date("2026-10-18T00:00:00Z"),
    ...overrides,
  };
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "p1",
    itemId: "i1",
    bidderId: "bidder-1",
    bidId: "b1",
    amount: 10_000,
    platformFeeCents: 500,
    sellerNetCents: 9_500,
    mpPaymentId: "mp-1",
    pixQrCode: null,
    pixCopiaECola: null,
    paymentLink: null,
    status: "pending",
    deadline: new Date("2026-10-19T12:00:00Z"), // vencido em NOW
    attemptNumber: 1,
    createdAt: new Date("2026-10-18T12:00:00Z"),
    updatedAt: new Date("2026-10-18T12:00:00Z"),
    ...overrides,
  };
}

class FakeItemRepo implements Pick<ItemRepository, "findById" | "setStatus"> {
  items = new Map<string, Item>();
  statuses: Array<{ id: string; status: Item["status"] }> = [];
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async setStatus(id: string, status: Item["status"]) {
    this.statuses.push({ id, status });
    const item = this.items.get(id);
    if (!item) return null;
    const updated = { ...item, status };
    this.items.set(id, updated);
    return updated;
  }
}

class FakeBidRepo implements BidRepository {
  bids: Bid[] = [];
  async findByItemId(itemId: string) {
    return this.bids.filter((b) => b.itemId === itemId).sort((a, b) => b.amount - a.amount);
  }
  async placeBid(): Promise<BidPlacement> {
    throw new Error("fora de escopo");
  }
  async listByBidder() {
    return [];
  }
}

class FakePaymentRepo implements PaymentRepository {
  payments: Payment[] = [];
  async createPayment(input: CreatePaymentInput): Promise<Payment> {
    const payment: Payment = {
      id: `p${this.payments.length + 1}`,
      ...input,
      attemptNumber: input.attemptNumber ?? 1,
      status: "pending",
      createdAt: NOW,
      updatedAt: NOW,
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
    return (
      this.payments.find((p) => p.itemId === itemId && p.attemptNumber === attemptNumber) ?? null
    );
  }
  async markCancelled(id: string) {
    return this.transition(id, "cancelled");
  }
  async markApproved(id: string) {
    return this.transition(id, "approved");
  }
  async markExpired(id: string) {
    return this.transition(id, "expired");
  }
  private transition(id: string, status: PaymentStatus) {
    const p = this.payments.find((x) => x.id === id);
    if (!p || p.status !== "pending") return null;
    p.status = status;
    return p;
  }
  async findExpiredPending(now: Date) {
    return this.payments.filter((p) => p.status === "pending" && p.deadline <= now);
  }
  async findExpired() {
    return this.payments.filter((p) => p.status === "expired");
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
  async create(input: CreateNotificationInput) {
    this.notifications.push(input);
    return { id: "n1", ...input, read: false, createdAt: NOW };
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

function makeMpClient() {
  const calls: Array<Record<string, unknown>> = [];
  const client: MpPaymentClient & { calls: typeof calls } = {
    calls,
    async createPixPayment(input) {
      calls.push(input as unknown as Record<string, unknown>);
      return {
        mpPaymentId: `mp-${calls.length}`,
        qrCodeBase64: "data:image/png;base64,QR",
        qrCopiaECola: "000201PIX",
      };
    },
  };
  return client;
}

function makeDeps(overrides: { item?: Item; bids?: Bid[]; payments?: Payment[] } = {}) {
  const itemRepo = new FakeItemRepo();
  itemRepo.items.set("i1", overrides.item ?? makeItem());
  const bidRepo = new FakeBidRepo();
  bidRepo.bids =
    overrides.bids ??
    [
      makeBid(),
      makeBid({ id: "b2", bidderId: "bidder-2", bidderName: "Bia", amount: 8_000, rank: 2 }),
    ];
  const paymentRepo = new FakePaymentRepo();
  paymentRepo.payments = overrides.payments ?? [
    makePayment(),
    makePayment({ id: "p9", bidderId: "bidder-9", bidId: "b9", attemptNumber: 9 }), // ruído: pendente de OUTRO item? não — mesmo item, mas nunca expira? deadline igual... ver abaixo
  ];
  paymentRepo.payments = (overrides.payments ?? [makePayment()]).map((p) => p);
  const userRepo = new FakeUserRepo();
  for (const [id, name] of [
    ["bidder-1", "Ana"],
    ["bidder-2", "Bia"],
  ] as const) {
    userRepo.users.set(id, {
      id,
      name,
      email: `${id}@exemplo.test`,
      phone: null,
      slug: null,
      address: null,
      role: "bidder",
    });
  }
  const notifRepo = new FakeNotifRepo();
  const mpClient = makeMpClient();
  const getAccessToken = vi.fn(async () => "APP_USR-vendedor");
  const deps = {
    itemRepo,
    bidRepo,
    paymentRepo,
    userRepo,
    notifRepo,
    mpClient,
    getAccessToken,
  };
  return { deps, itemRepo, bidRepo, paymentRepo, userRepo, notifRepo, mpClient, getAccessToken };
}

describe("verificarPrazos — vencimento", () => {
  it("vence o pendente cujo prazo passou (transição pendente→expirado)", async () => {
    const ctx = makeDeps();

    const result = await verificarPrazos(ctx.deps, NOW);

    expect(result.expired).toBe(1);
    expect(ctx.paymentRepo.payments[0]!.status).toBe("expired");
  });

  it("pendente com prazo FUTURO não é vencido", async () => {
    const ctx = makeDeps({
      payments: [makePayment({ deadline: new Date(NOW.getTime() + DAY) })],
    });

    const result = await verificarPrazos(ctx.deps, NOW);

    expect(result.expired).toBe(0);
    expect(ctx.paymentRepo.payments[0]!.status).toBe("pending");
  });
});

describe("verificarPrazos — cascata", () => {
  it("vencido com próximo lance: nova cobrança na tentativa seguinte com a taxa de 5% e prazo da cascata", async () => {
    const ctx = makeDeps();

    const result = await verificarPrazos(ctx.deps, NOW);

    expect(result.cascaded).toBe(1);
    const cascadePayment = ctx.paymentRepo.payments.find((p) => p.attemptNumber === 2);
    expect(cascadePayment).toMatchObject({
      bidderId: "bidder-2",
      bidId: "b2",
      amount: 8_000,
      platformFeeCents: 400,
      sellerNetCents: 7_600,
    });
    // prazo da cascata: default 1 dia (24h), não o paymentDeadlineDays do item
    expect(cascadePayment!.deadline.toISOString()).toBe(
      new Date(NOW.getTime() + DEFAULT_CASCADE_DAYS * DAY).toISOString(),
    );
    // notificação da chamada, não de vitória
    expect(ctx.notifRepo.notifications).toMatchObject([
      { userId: "bidder-2", type: "next_bidder_called" },
    ]);
  });

  it("o prazo da cascata respeita o cascadeDeadlineDays do item", async () => {
    const ctx = makeDeps({ item: makeItem({ cascadeDeadlineDays: 2 }) });

    await verificarPrazos(ctx.deps, NOW);

    const cascadePayment = ctx.paymentRepo.payments.find((p) => p.attemptNumber === 2);
    expect(cascadePayment!.deadline.toISOString()).toBe(
      new Date(NOW.getTime() + 2 * DAY).toISOString(),
    );
  });

  it("o próximo da fila EXCLUI quem já teve tentativa (mesmo arrematante com 2 lances)", async () => {
    // bidder-2 tem o 2º E o 3º maior lance; a cascata dele só pode ocorrer UMA vez
    const ctx = makeDeps({
      bids: [
        makeBid({ id: "b1", bidderId: "bidder-1", amount: 10_000 }),
        makeBid({ id: "b2", bidderId: "bidder-2", amount: 8_000 }),
        makeBid({ id: "b3", bidderId: "bidder-2", amount: 7_000 }),
      ],
    });

    await verificarPrazos(ctx.deps, NOW);
    const cascadePayment = ctx.paymentRepo.payments.find((p) => p.attemptNumber === 2);
    expect(cascadePayment!.bidderId).toBe("bidder-2");
    expect(cascadePayment!.bidId).toBe("b2"); // o maior dele, não o duplicado

    // segundo tick com a cascata já expirada de novo: ninguém sobrou
    cascadePayment!.status = "expired";
    const second = await verificarPrazos(ctx.deps, new Date(NOW.getTime() + 2 * DAY));
    expect(second.cascaded).toBe(0);
    expect(second.cancelledItems).toBe(1);
  });

  it("idempotente: `expired` cuja próxima tentativa já existe não recascata", async () => {
    const ctx = makeDeps();
    await verificarPrazos(ctx.deps, NOW);
    const created = ctx.paymentRepo.payments.find((p) => p.attemptNumber === 2)!;
    ctx.mpClient.calls.length = 0;

    // segundo tick: o mesmo expired, mas a tentativa 2 já existe
    const result = await verificarPrazos(ctx.deps, NOW);

    expect(result.cascaded).toBe(0);
    expect(ctx.mpClient.calls).toHaveLength(0);
    expect(created.status).toBe("pending");
  });

  it("lances esgotados: item cancelado + payment_expired ao ÚLTIMO acionado", async () => {
    const ctx = makeDeps({ bids: [makeBid()] }); // só o vencedor

    const result = await verificarPrazos(ctx.deps, NOW);

    expect(result.cascaded).toBe(0);
    expect(result.cancelledItems).toBe(1);
    expect(ctx.itemRepo.statuses).toEqual([{ id: "i1", status: "cancelled" }]);
    expect(ctx.notifRepo.notifications).toMatchObject([
      { userId: "bidder-1", type: "payment_expired" },
    ]);
  });

  it("item já pago ou cancelado não recascata", async () => {
    const ctx = makeDeps({ item: makeItem({ status: "cancelled" as Item["status"] }) });

    const result = await verificarPrazos(ctx.deps, NOW);

    expect(result.expired).toBe(1);
    expect(result.cascaded).toBe(0);
    expect(result.cancelledItems).toBe(0);
  });

  it("self-healing: cobrança da cascata que FALHOU num tick é refeita no seguinte", async () => {
    const ctx = makeDeps();
    ctx.mpClient.createPixPayment = async () => {
      throw new Error("MP fora do ar");
    };

    const first = await verificarPrazos(ctx.deps, NOW);
    expect(first.cascaded).toBe(0);
    expect(ctx.paymentRepo.payments.find((p) => p.attemptNumber === 2)).toBeUndefined();

    // MP voltou: o próximo tick reencontra o expired sem a tentativa 2
    ctx.mpClient = makeMpClient();
    ctx.deps.mpClient = ctx.mpClient;
    const second = await verificarPrazos(ctx.deps, NOW);
    expect(second.cascaded).toBe(1);
    expect(ctx.paymentRepo.payments.find((p) => p.attemptNumber === 2)).toBeDefined();
  });
});

describe("sincronizarMp — rede de segurança", () => {
  function payment(over: Partial<Payment> = {}) {
    return makePayment(over);
  }

  it("pendentes criados há mais de 1h passam pelo handler do webhook", async () => {
    const stale = payment({ createdAt: new Date(NOW.getTime() - 2 * DAY) });
    const fresh = payment({
      id: "p2",
      mpPaymentId: "mp-2",
      createdAt: new Date(NOW.getTime() - 30 * 60 * 1000),
      deadline: new Date(NOW.getTime() + DAY),
    });
    const semMp = payment({
      id: "p3",
      mpPaymentId: null,
      createdAt: new Date(NOW.getTime() - 2 * DAY),
      deadline: new Date(NOW.getTime() + DAY),
    });
    const ctx = makeDeps({ payments: [stale, fresh, semMp] });
    const handleWebhook = vi.fn(async () => ({ result: "ignored" }));

    const result = await sincronizarMp(
      { paymentRepo: ctx.paymentRepo, handleWebhook },
      NOW,
    );

    expect(result.checked).toBe(1);
    expect(handleWebhook).toHaveBeenCalledTimes(1);
    expect(handleWebhook).toHaveBeenCalledWith("mp-1");
  });

  it("falha ao sincronizar UM pagamento não derruba os outros (best-effort)", async () => {
    const a = payment({ createdAt: new Date(NOW.getTime() - 2 * DAY) });
    const b = payment({
      id: "p2",
      bidderId: "bidder-2",
      bidId: "b2",
      mpPaymentId: "mp-2",
      createdAt: new Date(NOW.getTime() - 2 * DAY),
      deadline: new Date(NOW.getTime() + DAY),
    });
    const ctx = makeDeps({ payments: [a, b] });
    const handleWebhook = vi
      .fn()
      .mockRejectedValueOnce(new Error("MP fora do ar"))
      .mockResolvedValueOnce({ result: "ignored" });

    const result = await sincronizarMp({ paymentRepo: ctx.paymentRepo, handleWebhook }, NOW);

    expect(handleWebhook).toHaveBeenCalledTimes(2);
    expect(result.checked).toBe(1); // o segundo passou apesar do primeiro falhar
  });
});

// importa o createPayment para garantir que o cascade usa a MESMA mecânica de
// taxa/pix (o teste acima já valida o resultado; isto evita tree-shake do
// import no bundle de teste)
void createPayment;
