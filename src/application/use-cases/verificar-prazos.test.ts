import { describe, expect, it, vi } from "vitest";
import { verificarPrazos, sincronizarMp, DEFAULT_CASCADE_DAYS } from "./verificar-prazos";
import { createPayment, type PagBankPaymentClient } from "./create-payment";
import type { Bid, BidPlacement, BidRepository } from "@/domain/repositories/bid-repository";
import type { Item, ItemRepository } from "@/domain/repositories/item-repository";
import type { Payment, PaymentStatus } from "@/domain/repositories/payment-repository";
import { FakePaymentRepository } from "@/test/fakes/payment-repository";
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
    reminderSentAt: null,
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
    return { id: "n1", ...input, read: false, link: null, createdAt: NOW };
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
  const client = {
    calls,
    async createPix(input: Record<string, unknown>) {
      calls.push(input);
      return {
        orderId: `pb-order-${calls.length}`,
        chargeId: `pb-charge-${calls.length}`,
        qrCodeBase64: "data:image/png;base64,QR",
        qrCodeText: "000201PIX",
        status: "PENDING",
      };
    },
    async createCheckout() {
      return { checkoutId: `pb-checkout-${calls.length}`, checkoutUrl: "https://pagbank.test/checkout" };
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
  const paymentRepo = new FakePaymentRepository();
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
  const getAccessToken = vi.fn(async () => "pagbank-token");
  const deps = {
    itemRepo,
    bidRepo,
    paymentRepo,
    userRepo,
    notifRepo,
    getAccessToken,
    getAccountId: vi.fn(async () => "pagbank-account-123"),
    platformAccountId: "platform-account",
    notificationUrl: "http://localhost:3000/api/webhooks/pagbank",
    createPix: mpClient.createPix,
    createCheckout: mpClient.createCheckout,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
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
    // as DUAS portas falham no primeiro tick (só o PIX falhar já não basta:
    // o link do checkout carrega a cobrança sozinho agora)
    const origPix = ctx.deps.createPix;
    const origCheckout = ctx.deps.createCheckout;
    (ctx.deps as any).createPix = async () => {
      throw new Error("PagBank fora do ar");
    };
    (ctx.deps as any).createCheckout = async () => {
      throw new Error("PagBank fora do ar");
    };

    const first = await verificarPrazos(ctx.deps, NOW);
    expect(first.cascaded).toBe(0);
    expect(ctx.paymentRepo.payments.find((p) => p.attemptNumber === 2)).toBeUndefined();

    // PagBank voltou: o próximo tick reencontra o expired sem a tentativa 2
    (ctx.deps as any).createPix = origPix;
    (ctx.deps as any).createCheckout = origCheckout;
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

// ponytail: os E-MAILS do cron. O lembrete `payment_due` é o caso delicado:
// o cron roda a cada 10min e a coluna `reminder_sent_at` (mais o
// `markReminderSent` atômico) é o que faz o arrematante receber UM e-mail,
// e não 144. O guarda de janela exclui cobranças de cascata (nascem com
// prazo de 24h — o e-mail de chamada já é o aviso).
describe("verificarPrazos — e-mails", () => {
  const HOUR = 60 * 60 * 1000;

  function fakeResend() {
    const sent: Array<{ to: string; subject: string }> = [];
    return {
      sent,
      emails: {
        send: async (args: { to: string; subject: string }) => {
          sent.push(args);
          return { data: { id: "e1" }, error: null };
        },
      },
    };
  }

  it("pendente com vencimento em <24h e janela longa recebe lembrete payment_due UMA vez", async () => {
    // criado há 2 dias, vence em 12h: janela de 3 dias > 24h → lembrete
    const ctx = makeDeps({
      payments: [
        makePayment({
          createdAt: new Date(NOW.getTime() - 2 * DAY),
          deadline: new Date(NOW.getTime() + 12 * HOUR),
        }),
      ],
    });
    const resend = fakeResend();
    const deps = { ...ctx.deps, resend };

    const first = await verificarPrazos(deps, NOW);
    expect(first.reminded).toBe(1);
    expect(resend.sent[0]).toMatchObject({ subject: "Seu pagamento vence em breve" });

    // segundo tick: o lembrete JÁ foi enviado (coluna marcada)
    const second = await verificarPrazos({ ...ctx.deps, resend }, NOW);
    expect(second.reminded).toBe(0);
    expect(resend.sent).toHaveLength(1);
  });

  it("cobrança de cascata (janela de 24h) NÃO recebe lembrete — a chamada já avisou", async () => {
    const ctx = makeDeps({
      payments: [
        makePayment({
          createdAt: new Date(NOW.getTime() - 1 * HOUR),
          deadline: new Date(NOW.getTime() + 23 * HOUR), // janela ~24h
        }),
      ],
    });
    const resend = fakeResend();

    const result = await verificarPrazos({ ...ctx.deps, resend }, NOW);

    expect(result.reminded).toBe(0);
    expect(resend.sent).toHaveLength(0);
  });

  it("pendente com vencimento longe (>24h) não recebe lembrete ainda", async () => {
    const ctx = makeDeps({
      payments: [makePayment({ deadline: new Date(NOW.getTime() + 3 * DAY) })],
    });
    const resend = fakeResend();

    const result = await verificarPrazos({ ...ctx.deps, resend }, NOW);

    expect(result.reminded).toBe(0);
  });

  it("lances esgotados envia payment_expired por e-mail ao último acionado", async () => {
    const ctx = makeDeps({ bids: [makeBid()] }); // só o vencedor → esgota
    const resend = fakeResend();

    await verificarPrazos({ ...ctx.deps, resend }, NOW);

    expect(resend.sent).toHaveLength(1);
    expect(resend.sent[0]).toMatchObject({ subject: "Prazo de pagamento vencido" });
  });
});

// ponytail: o cancelamento ERA um beco sem saída — a versão que só via
// `expired` deixava o item `closed` para sempre. Estes testes travam que
// desistir da cobrança chama o próximo (e esgotando, encerra o item).
describe("verificarPrazos — cancelamento dispara cascata", () => {
  it("cobrança CANCELADA pelo arrematante chama o próximo da fila", async () => {
    const ctx = makeDeps({
      payments: [
        makePayment({ id: "p1", bidderId: "bidder-1", status: "cancelled" as PaymentStatus }),
      ],
    });

    const result = await verificarPrazos(ctx.deps, NOW);

    expect(result.cascaded).toBe(1);
    expect(ctx.paymentRepo.payments.find((p) => p.attemptNumber === 2)).toMatchObject({
      bidderId: "bidder-2",
    });
  });

  it("cancelada sem mais lances: item cancelled + payment_expired ao último", async () => {
    const ctx = makeDeps({
      bids: [makeBid()], // só o vencedor
      payments: [
        makePayment({ status: "cancelled" as PaymentStatus }),
      ],
    });

    const result = await verificarPrazos(ctx.deps, NOW);

    expect(result.cascaded).toBe(0);
    expect(result.cancelledItems).toBe(1);
    expect(ctx.itemRepo.statuses).toEqual([{ id: "i1", status: "cancelled" }]);
  });

  it("cobrança APROVADA nunca é candidata de cascata (nem REFUNDED)", async () => {
    const ctx = makeDeps({
      payments: [
        makePayment({ status: "approved" as PaymentStatus }),
        makePayment({ id: "p2", status: "refunded" as PaymentStatus }),
      ],
    });

    const result = await verificarPrazos(ctx.deps, NOW);

    expect(result.cascaded).toBe(0);
    expect(result.cancelledItems).toBe(0);
    expect(ctx.itemRepo.statuses).toEqual([]);
  });
});
