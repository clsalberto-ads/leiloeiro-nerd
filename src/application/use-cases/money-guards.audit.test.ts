import { describe, expect, it, vi } from "vitest";

import { createItem } from "./create-item";
import { placeBid } from "./place-bid";
import type { ItemRepository } from "@/domain/repositories/item-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";

const SELLER = { id: "u1", name: "Ana", email: "ana@ex.com", phone: null, slug: "ana", address: null, role: "seller" as const };
const HOJE = new Date(Date.now() + 86_400_000);
const ONTEM = new Date(Date.now() - 86_400_000);

const BASE = {
  title: "Item",
  description: "d",
  type: "product" as const,
  minInitialBid: 1000,
  minBidIncrement: 500,
  bidDeadline: HOJE,
  paymentDeadlineDays: 3,
};

function emptyRepo(user = SELLER) {
  const repo = {
    async create(input: Record<string, unknown>) {
      return { ...BASE, id: "i1", sellerId: "u1", status: "draft", imageUrl: null, createdAt: new Date(), ...input } as never;
    },
    async findById() {
      return null;
    },
    async createImages() {},
    async update() {
      return null as never;
    },
  };
  // o `createItem` so usa `create`/`createImages`; o resto do contrato existe
  // porque `ItemRepository` e uma interface com 9 metodos e o teste nao deve
  // depender de quantos sao obrigatorios.
  return repo as unknown as ItemRepository;
}

const userRepo = { async findById() { return SELLER; } } as unknown as UserRepository;

// ponytail: `createItem` e `placeBid`. O piso de dinheiro aqui existe porque
// `placeBid` o faz pelo mesmo motivo ("existe justamente para nao confiar no
// schema" — ver o comentario do irmao `placeBid`) — mas o proprio piso falha
// aberto para valor nao-finite e deixa `NaN` chegar ao INSERT, estourando
// `22003 numeric_value_out_of_range` no Postgres. Um guard que so segura metade do dominio e pior que nenhum: da
// sensacao de protecao sem dar.
describe("createItem — o piso de dinheiro segura valor nao-finite", () => {
  it("minInitialBid Infinity nao passa", async () => {
    await expect(
      createItem(emptyRepo(), userRepo, "u1", { ...BASE, minInitialBid: Infinity }),
    ).rejects.toThrow(/R\$ 1,00/);
  });

  it("minInitialBid NaN nao passa", async () => {
    await expect(createItem(emptyRepo(), userRepo, "u1", { ...BASE, minInitialBid: NaN })).rejects.toThrow(/R\$ 1,00/);
  });

  it("minBidIncrement Infinity nao passa", async () => {
    await expect(
      createItem(emptyRepo(), userRepo, "u1", { ...BASE, minBidIncrement: Infinity }),
    ).rejects.toThrow(/R\$ 1,00/);
  });

  it("minInitialBid fracionario nao passa (centavos, nao reais)", async () => {
    await expect(createItem(emptyRepo(), userRepo, "u1", { ...BASE, minInitialBid: 1000.5 })).rejects.toThrow(/R\$ 1,00/);
  });

  it("valor valido continua passando", async () => {
    await expect(createItem(emptyRepo(), userRepo, "u1", { ...BASE, minInitialBid: 1000 })).resolves.toBeDefined();
  });

  // ponytail: `paymentDeadlineDays` e o UNICO campo sem re-validacao no use case,
  // e a coluna nao tem CHECK. O schema limita a 1..30, mas um chamador nao-Zod
  // guardaria 0 e a janela de pagamento e calculada a partir disso.
  it("paymentDeadlineDays fora de 1..30 nao passa", async () => {
    await expect(
      createItem(emptyRepo(), userRepo, "u1", { ...BASE, paymentDeadlineDays: 0 }),
    ).rejects.toThrow(/[Pp]agamento/);
    await expect(
      createItem(emptyRepo(), userRepo, "u1", { ...BASE, paymentDeadlineDays: 999 }),
    ).rejects.toThrow(/[Pp]agamento/);
  });

  it("bidDeadline no passado nao passa", async () => {
    await expect(
      createItem(emptyRepo(), userRepo, "u1", { ...BASE, bidDeadline: ONTEM }),
    ).rejects.toThrow(/futuro/);
  });

  it("bidder nao cria item", async () => {
    const bidder = { ...SELLER, role: "bidder" as const };
    await expect(
      createItem(emptyRepo(), { async findById() { return bidder; } } as unknown as UserRepository, "u1", { ...BASE }),
    ).rejects.toThrow(/leiloeiros/i);
  });
});

// ponytail: `placeBid` re-checa dentro da transacao status, prazo, seller e
// `amount` — a segunda porta que nao confia no schema. `amount`, porem, nunca era
// validado, e `NaN` e `Infinity` passam: um `amount` nao-finite atravessava os
// quatro checks e ia para a coluna `bids.amount`. Como o `validate` do repositorio roda DENTRO da
// transacao e o guard e o ultimo portao antes do INSERT, o throw e o que
// impede o `amount` de ser gravado — mas so se existir.
const ACTIVE_ITEM = {
  id: "i1",
  title: "Item",
  status: "active",
  sellerId: "u2",
  minInitialBid: 1000,
  minBidIncrement: 500,
  bidDeadline: new Date(Date.now() + 86_400_000),
};

function bidRepos() {
  return {
    async findById() {
      return ACTIVE_ITEM;
    },
    async placeBid(_input: Record<string, unknown>, validate: (ctx: unknown) => void) {
      validate({ item: ACTIVE_ITEM, highestBid: undefined });
      return { bid: { id: "b1", itemId: "i1", bidderId: "u1", bidderName: "Ana", amount: 0, rank: 1, createdAt: new Date() }, previousHighestBid: null };
    },
  };
}

const OUTROS = {
  userRepo: { async findById() { return { id: "u1", role: "bidder" }; } } as never,
  notifRepo: { async create() {} } as never,
  resend: {} as never,
};

describe("placeBid — amount precisa ser inteiro finito", () => {
  it.each([
    [NaN, /Lance/],
    [Infinity, /Lance/],
    [-Infinity, /Lance/],
    [0, /Lance/],
    [99, /Lance/],
    [1000.5, /Lance/],
  ])("amount %o e recusado antes do INSERT", async (amount, pattern) => {
    const repo = bidRepos();
    await expect(placeBid(repo as never, repo as never, OUTROS.userRepo, OUTROS.notifRepo, OUTROS.resend, "u1", "i1", amount as number)).rejects.toThrow(pattern);
  });

  it("amount valido passa", async () => {
    const repo = bidRepos();
    await expect(placeBid(repo as never, repo as never, OUTROS.userRepo, OUTROS.notifRepo, OUTROS.resend, "u1", "i1", 1000)).resolves.toBeDefined();
  });

  // `invalidMoney` valida amount e minBid na MESMA regra, entao um incremento
  // fracionario herdado do item precisa derrubar o lance tambem — senao o
  // `minBid` da mensagem mente sobre um valor que o banco aceitou.
  it("incremento fracionario no item tambem derruba o lance", async () => {
    const item = { ...ACTIVE_ITEM, minInitialBid: 1000.5 };
    const repo = {
      async findById() {
        return item;
      },
      async placeBid(_i: Record<string, unknown>, validate: (ctx: unknown) => void) {
        validate({ item, highestBid: undefined });
        return { bid: {}, previousHighestBid: null };
      },
    };
    await expect(placeBid(repo as never, repo as never, OUTROS.userRepo, OUTROS.notifRepo, OUTROS.resend, "u1", "i1", 1001)).rejects.toThrow(/Lance/);
  });
});
