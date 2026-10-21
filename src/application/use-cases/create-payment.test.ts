import { describe, expect, it, vi } from "vitest";
import { createPayment, type CreatePaymentDeps, type PagBankPaymentClient } from "./create-payment";
import type { Bid, BidPlacement, BidRepository } from "@/domain/repositories/bid-repository";
import type { Item, ItemRepository, ItemStatus } from "@/domain/repositories/item-repository";
import { FakePaymentRepository } from "@/test/fakes/payment-repository";
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
      link: null,
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

function makePixClient() {
  const calls: Array<Record<string, unknown>> = [];
  const fn = async (input: Record<string, unknown>) => {
    calls.push(input);
    return {
      mpPaymentId: "pb-order-123",
      chargeId: "pb-charge-123",
      qrCodeBase64: "data:image/png;base64,QR",
      qrCodeText: "00020126PIX",
      status: "PENDING",
    };
  };
  return { fn, calls };
}

function makeCheckoutClient() {
  const fn = async () => ({
    checkoutId: "pb-checkout-1",
    checkoutUrl: "https://pagbank.test/checkout/pb-checkout-1",
  });
  return { fn };
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
  const paymentRepo = new FakePaymentRepository();
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
  const pixClient = makePixClient();
  const checkoutClient = makeCheckoutClient();
  const getAccessToken = vi.fn(async () => overrides.token ?? "pagbank-token");
  const getAccountId = vi.fn(async () => "pagbank-account-123");
  const mpClient = { calls: pixClient.calls };

  return {
    deps: {
      itemRepo,
      bidRepo,
      paymentRepo,
      userRepo,
      notifRepo,
      getAccessToken,
      getAccountId,
      platformAccountId: "platform-account",
      notificationUrl: "http://localhost:3000/api/webhooks/pagbank",
      createPix: pixClient.fn,
      createCheckout: checkoutClient.fn,
    } as unknown as CreatePaymentDeps,
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
      accessToken: "pagbank-token",
      amountCents: 10_000,
      platformFeeCents: 500,
      description: "Arremate: Console raro",
      payerEmail: "ana@exemplo.test",
    });
    expect(ctx.paymentRepo.payments[0]).toMatchObject({
      amount: 10_000,
      platformFeeCents: 500,
      sellerNetCents: 9_500,
      mpPaymentId: "pb-order-123",
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
    expect(stillCreated.mpPaymentId).toBe("pb-order-123");
    expect(failing.paymentRepo.payments).toHaveLength(1);
  });

  it("arrematante sem e-mail para a cobrança é erro antes de chamar a MP", async () => {
    const ctx = makeDeps({ users: [] });

    await expect(createPayment(ctx.deps, "i1", NOW)).rejects.toThrow("e-mail");
    expect(ctx.mpClient.calls).toHaveLength(0);
  });
});

// ponytail (R6.2): o ciclo do item agora usa o status que existia no enum
// desde a fundação — criada a cobrança da tentativa 1, o item deixa de ser
// "encerrado" e passa a "aguardando pagamento" (a aba que o vendedor lê).
// A transição vem ANTES da MP: se a chamada falhar, o estado já está certo e
// a retomada funciona.
describe("createPayment — transição awaiting_payment (R6.2)", () => {
  it("item closed ganha cobrança → transita para awaiting_payment", async () => {
    const ctx = makeDeps();
    await createPayment(ctx.deps, "i1", NOW);

    expect(ctx.itemRepo.statuses).toEqual([{ id: "i1", status: "awaiting_payment" }]);
  });

  it("item JÁ em awaiting_payment não re-transita (idempotente) e a retomada segue", async () => {
    const ctx = makeDeps({
      item: makeItem({ status: "awaiting_payment" as ItemStatus }),
    });

    const payment = await createPayment(ctx.deps, "i1", NOW);

    expect(ctx.itemRepo.statuses).toEqual([]); // nenhuma transição extra
    expect(payment.mpPaymentId).toBe("pb-order-123"); // cobrança criada de novo
  });

  it("item em awaiting_payment COM cobrança existente devolve a mesma (idempotência por tentativa)", async () => {
    const ctx = makeDeps({
      item: makeItem({ status: "awaiting_payment" as ItemStatus }),
    });
    const first = await createPayment(ctx.deps, "i1", NOW);
    ctx.mpClient.calls.length = 0;

    const again = await createPayment(ctx.deps, "i1", NOW);

    expect(again.id).toBe(first.id);
    expect(ctx.mpClient.calls).toHaveLength(0);
  });

  it("item active continua recusado (o ciclo começa em closed)", async () => {
    const ctx = makeDeps({ item: makeItem({ status: "active" as ItemStatus }) });
    await expect(createPayment(ctx.deps, "i1", NOW)).rejects.toThrow("encerrado");
    expect(ctx.itemRepo.statuses).toEqual([]);
  });
});

// ponytail (R6.1): a cobrança nasce com DUAS portas — PIX (qr + copia-e-cola)
// e o link do Checkout Pro (cartão) — cada uma best-effort para a outra.
describe("createPayment — link de checkout (cartão)", () => {
  it("grava o paymentLink junto do PIX", async () => {
    const ctx = makeDeps();
    const payment = await createPayment(ctx.deps, "i1", NOW);
    expect(payment.mpPaymentId).toBe("pb-order-123");
    expect(payment.pixCopiaECola).toBe("00020126PIX");
    expect(payment.paymentLink).toBe("https://pagbank.test/checkout/pb-checkout-1");
  });

  it("PIX falha → cobrança nasce SÓ com o link (cartão como caminho completo)", async () => {
    const ctx = makeDeps();
    ctx.deps.createPix = async () => {
      throw new Error("PIX fora do ar");
    };
    const payment = await createPayment(ctx.deps, "i1", NOW);
    expect(payment.mpPaymentId).toBeNull();
    expect(payment.pixCopiaECola).toBeNull();
    expect(payment.paymentLink).toBe("https://pagbank.test/checkout/pb-checkout-1");
  });

  it("link falha → cobrança nasce só com PIX (cartão é bônus, não dependência)", async () => {
    const ctx = makeDeps();
    ctx.deps.createCheckout = async () => {
      throw new Error("preferência recusada");
    };
    const payment = await createPayment(ctx.deps, "i1", NOW);
    expect(payment.mpPaymentId).toBe("pb-order-123");
    expect(payment.paymentLink).toBeNull();
  });

  it("as DUAS falham → a cobrança não nasce (o próximo tick refaz)", async () => {
    const ctx = makeDeps();
    ctx.deps.createPix = async () => {
      throw new Error("pix caiu");
    };
    ctx.deps.createCheckout = async () => {
      throw new Error("pref caiu");
    };
    await expect(createPayment(ctx.deps, "i1", NOW)).rejects.toThrow("Nem PIX nem link");
    expect(ctx.paymentRepo.payments).toHaveLength(0);
  });
});
