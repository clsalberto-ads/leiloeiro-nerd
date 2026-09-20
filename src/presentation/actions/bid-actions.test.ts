import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  placeBid: vi.fn(),
  getItemBids: vi.fn(),
  createResendClient: vi.fn(() => ({})),
}));

vi.mock("./auth-actions", () => ({ getSession: mocks.getSession }));
vi.mock("@/application/use-cases/place-bid", () => ({ placeBid: mocks.placeBid }));
vi.mock("@/application/use-cases/get-item-bids", () => ({ getItemBids: mocks.getItemBids }));
vi.mock("@/infrastructure/email/resend", () => ({ createResendClient: mocks.createResendClient }));
vi.mock("@/infrastructure/database/repositories/drizzle-item-repository", () => ({ drizzleItemRepository: {} }));
vi.mock("@/infrastructure/database/repositories/drizzle-bid-repository", () => ({ drizzleBidRepository: {} }));
vi.mock("@/infrastructure/database/repositories/drizzle-user-repository", () => ({ drizzleUserRepository: {} }));
vi.mock("@/infrastructure/database/repositories/drizzle-notification-repository", () => ({
  drizzleNotificationRepository: {},
}));

import { getItemBidsAction, placeBidAction } from "./bid-actions";
import type { Bid } from "@/domain/repositories/bid-repository";

const ITEM_ID = "0b61e95c-2be1-4d38-8f74-3c5a3a1c8f3a";

function bidForm(itemId: string, amount: string) {
  const fd = new FormData();
  fd.set("itemId", itemId);
  fd.set("amount", amount);
  return fd;
}

function makeBid(overrides: Partial<Bid> = {}): Bid {
  return {
    id: "b1",
    itemId: ITEM_ID,
    bidderId: "u2",
    bidderName: "Ana",
    amount: 15000,
    rank: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("placeBidAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "u1" } });
  });

  it("retorna erro quando não autenticado (guard de sessão)", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(placeBidAction(null, bidForm(ITEM_ID, "15000"))).resolves.toEqual({ error: "Não autenticado" });
    expect(mocks.placeBid).not.toHaveBeenCalled();
  });

  it("rejeita lance abaixo do mínimo na validação", async () => {
    await expect(placeBidAction(null, bidForm(ITEM_ID, "99"))).resolves.toEqual({
      error: "Lance mínimo R$ 1,00",
    });
    expect(mocks.placeBid).not.toHaveBeenCalled();
  });

  it("rejeita itemId que não é UUID", async () => {
    const res = await placeBidAction(null, bidForm("nao-uuid", "15000"));
    expect(res.error).toBeDefined();
    expect(mocks.placeBid).not.toHaveBeenCalled();
  });

  it("registra lance válido e retorna { ok, bid }", async () => {
    const bid = makeBid();
    mocks.placeBid.mockResolvedValue({ bid });
    await expect(placeBidAction(null, bidForm(ITEM_ID, "15000"))).resolves.toEqual({ ok: true, bid });
    expect(mocks.placeBid).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), "u1", ITEM_ID, 15000);
  });

  it("retorna erro do use case quando lane é inválido", async () => {
    mocks.placeBid.mockRejectedValue(new Error("Item não está em leilão"));
    await expect(placeBidAction(null, bidForm(ITEM_ID, "15000"))).resolves.toEqual({
      error: "Item não está em leilão",
    });
  });
});

describe("getItemBidsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("funciona sem sessão (polling público da vitrine §8.1)", async () => {
    mocks.getSession.mockResolvedValue(null);
    const bids = [makeBid()];
    mocks.getItemBids.mockResolvedValue(bids);
    await expect(getItemBidsAction(null, bidForm(ITEM_ID, ""))).resolves.toEqual({ ok: true, bids });
    expect(mocks.getItemBids).toHaveBeenCalledWith(expect.anything(), expect.anything(), ITEM_ID);
  });

  it("retorna erro quando itemId está ausente", async () => {
    await expect(getItemBidsAction(null, new FormData())).resolves.toEqual({ error: "Item ID obrigatório" });
    expect(mocks.getItemBids).not.toHaveBeenCalled();
  });

  it("propaga erro do use case", async () => {
    mocks.getItemBids.mockRejectedValue(new Error("Erro ao buscar lances"));
    await expect(getItemBidsAction(null, bidForm(ITEM_ID, ""))).resolves.toEqual({
      error: "Erro ao buscar lances",
    });
  });
});