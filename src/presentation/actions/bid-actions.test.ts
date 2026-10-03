import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  placeBid: vi.fn(),
  getItemBids: vi.fn(),
  resolveBidderNames: vi.fn(async (bids: unknown) => bids),
  findItemById: vi.fn(),
  createResendClient: vi.fn(() => ({})),
  findUserIds: vi.fn(async () => []),
}));

vi.mock("./auth-actions", () => ({ getSession: mocks.getSession }));
vi.mock("@/application/use-cases/place-bid", () => ({ placeBid: mocks.placeBid }));
// `toBidView` fica REAL aqui de proposito: ele e a fronteira que tira o
// `bidderId` do payload, e um mock stubs-function devolveria `undefined` e
// esconderia justamente o comportamento que estes testes precisam travar.
vi.mock("@/application/use-cases/get-item-bids", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/application/use-cases/get-item-bids")>()),
  getItemBids: mocks.getItemBids,
  resolveBidderNames: mocks.resolveBidderNames,
}));
vi.mock("@/infrastructure/email/resend", () => ({ createResendClient: mocks.createResendClient }));
vi.mock("@/infrastructure/database/repositories/drizzle-item-repository", () => ({
  drizzleItemRepository: { findById: mocks.findItemById },
}));
vi.mock("@/infrastructure/database/repositories/drizzle-bid-repository", () => ({ drizzleBidRepository: {} }));
vi.mock("@/infrastructure/database/repositories/drizzle-user-repository", () => ({
  drizzleUserRepository: { findByIds: mocks.findUserIds },
}));
vi.mock("@/infrastructure/database/repositories/drizzle-notification-repository", () => ({
  drizzleNotificationRepository: {},
}));

import { getItemBidsAction, placeBidAction } from "./bid-actions";
import type { Bid, BidView } from "@/domain/repositories/bid-repository";

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

/** O que a action promete devolver: o `Bid` do servidor sem o `bidderId`. */
function asView(bid: Bid): BidView {
  const { bidderId: _bidderId, ...view } = bid;
  return view;
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
    await expect(placeBidAction(null, bidForm(ITEM_ID, "15000"))).resolves.toEqual({ ok: true, bid: asView(bid) });
    expect(mocks.placeBid).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), "u1", ITEM_ID, 15000);
  });

  // ponytail: o `bidderId` nao pode atravessar a fronteira. O `BidSection` e
  // `"use client"`, entao o objeto inteiro vai serializado no payload do RSC e
  // fica no navegador de qualquer visitante da vitrine — e nenhum componente do
  // cliente usa o campo. O teste usa `Object.keys` de proposito: `not.toHaveProperty`
  // passa em `undefined` e nao provaria nada; aqui o lance TEM `bidderId` no
  // servidor e a action precisa terRemoved.
  it("nao devolve o bidderId do arrematante para o cliente", async () => {
    const bid = makeBid({ bidderId: "u2", bidderName: "Ana" });
    mocks.placeBid.mockResolvedValue({ bid });

    const res = await placeBidAction(null, bidForm(ITEM_ID, "15000"));

    expect(res.bid).toBeDefined();
    expect(Object.keys(res.bid!)).not.toContain("bidderId");
    expect(res.bid).toEqual(asView(bid));
  });

  // ponytail: `placeBid` devolve o lance como o repositorio gravou, e o
  // repositorio de lances NAO sabe o nome — poe o `bidderId` no lugar do
  // `bidderName` (`bid-repository.ts`). Quem resolve o nome e o
  // `resolveBidderNames`, que a vitrine chama pelo `bidderName`. Sem repetir a
  // resolucao aqui, o lance que o USUARIO ACABOU de dar voltava pro `bid`
  // com `bidderName` = UUID e aparecia no historico publico como
  // "0b61e95c-2be1-4d38-8f74-3c5a3a1c8f3a" — ao lado dos lances antigos, que
  // mostravam o nome. O proprio Lanceador vazava o UUID de quem acabou de
  // licitar, num item publico, para qualquer visitante.
  it("resolve o nome do arrematante antes de devolver o lance ao historico", async () => {
    const cru = makeBid({ bidderId: "u2", bidderName: "u2" });
    const resolvido = makeBid({ bidderId: "u2", bidderName: "Ana" });
    mocks.placeBid.mockResolvedValue({ bid: cru });
    mocks.resolveBidderNames.mockResolvedValue([resolvido]);

    const res = await placeBidAction(null, bidForm(ITEM_ID, "15000"));

    expect(mocks.resolveBidderNames).toHaveBeenCalledWith([cru], expect.anything());
    expect(res.bid?.bidderName).toBe("Ana");
  });

  it("nao devolve o lance com bidderName igual ao bidderId quando o usuario sumiu", async () => {
    // lance cujo `bidderName` nao volta na consulta: `resolveBidderNames` mantem o
    // `bidderName` que veio. O guard e sobre o UUID NAO aparecer, e o preco e uma
    // segunda consulta por lance so no caso de 404 de usuario — evento rarissimo.
    const cru = makeBid({ bidderId: "u9", bidderName: "u9" });
    mocks.placeBid.mockResolvedValue({ bid: cru });
    mocks.resolveBidderNames.mockResolvedValue([{ ...cru, bidderName: "Usuario removido" }]);

    const res = await placeBidAction(null, bidForm(ITEM_ID, "15000"));
    expect(res.bid?.bidderName).not.toBe("u9");
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
    // o default e um item ATIVO: e o unico caso em que o historico e publico.
    mocks.findItemById.mockResolvedValue({ id: ITEM_ID, status: "active" });
  });

  it("funciona sem sessão (polling público da vitrine §8.1)", async () => {
    mocks.getSession.mockResolvedValue(null);
    const bids = [makeBid()];
    mocks.getItemBids.mockResolvedValue(bids);
    await expect(getItemBidsAction(null, bidForm(ITEM_ID, ""))).resolves.toEqual({ ok: true, bids });
    expect(mocks.getItemBids).toHaveBeenCalledWith(expect.anything(), expect.anything(), ITEM_ID);
  });

  it("retorna erro quando itemId está ausente", async () => {
    await expect(getItemBidsAction(null, new FormData())).resolves.toEqual({ error: "Item ID inválido" });
    expect(mocks.getItemBids).not.toHaveBeenCalled();
  });

  it("propaga erro do use case", async () => {
    mocks.getItemBids.mockRejectedValue(new Error("Erro ao buscar lances"));
    await expect(getItemBidsAction(null, bidForm(ITEM_ID, ""))).resolves.toEqual({
      error: "Erro ao buscar lances",
    });
  });

  // ponytail: a guarda de UUID nao e cosmeticamente defensiva. `bids.item_id` e
  // `uuid`, entao um `itemId` de outro formato estourava
  // `invalid input syntax for type uuid` do Postgres DENTRO do catch, que
  // devolvia `err.message` cru para um chamador anonimo. Um POST a mao
  // reachava isso em qualquer pagina publica da aplicacao.
  it("recusa itemId fora do formato uuid sem tocar no banco", async () => {
    for (const ruim of ["x", "1; DROP TABLE bids", "../../etc/passwd", "0b61e95c-2be1-4d38-8f74"]) {
      await expect(getItemBidsAction(null, bidForm(ruim, ""))).resolves.toEqual({ error: "Item ID inválido" });
    }
    expect(mocks.getItemBids).not.toHaveBeenCalled();
    expect(mocks.findItemById).not.toHaveBeenCalled();
  });

  // ponytail: este endpoint e publico por design, mas "publico" nao pode virar
  // "qualquer item". Antes do gate, um chamador anonimo iterava UUIDs e lia o
  // historico completo — COM o nome do arrematante resolvido — de itens
  // `cancelled` e `closed`, que o site nao expoe em lugar nenhum (a vitrine so
  // lista ativos e a pagina de detalhe so abre ativos).
  it("nao revela lances de item que nao esta ativo", async () => {
    for (const status of ["cancelled", "closed", "awaiting_payment", "paid", "draft"]) {
      mocks.findItemById.mockResolvedValue({ id: ITEM_ID, status });
      await expect(getItemBidsAction(null, bidForm(ITEM_ID, ""))).resolves.toEqual({
        error: "Lances indisponíveis",
      });
    }
    expect(mocks.getItemBids).not.toHaveBeenCalled();
  });

  it("nao revela lances de item inexistente", async () => {
    mocks.findItemById.mockResolvedValue(null);
    await expect(getItemBidsAction(null, bidForm(ITEM_ID, ""))).resolves.toEqual({
      error: "Lances indisponíveis",
    });
    expect(mocks.getItemBids).not.toHaveBeenCalled();
  });

  // ponytail: o `err.message` de um driver NAO volta para o cliente (o
  // `Failed query: ... params: ...` do pg e o `ECONNREFUSED host:port` sao
  // respectivamente inuteis e uma dica de topologia). O `getItemBids` do use case
  // continua devolvendo a sua propria mensagem, que e a que o teste acima fixa.
  it("nao devolve a mensagem do driver quando a consulta falha", async () => {
    mocks.findItemById.mockRejectedValue(
      Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" }),
    );
    await expect(getItemBidsAction(null, bidForm(ITEM_ID, ""))).resolves.toEqual({
      error: "Erro ao buscar lances",
    });
  });
});