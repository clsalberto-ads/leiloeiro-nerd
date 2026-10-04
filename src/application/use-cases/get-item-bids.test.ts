import { describe, expect, it } from "vitest";
import { getItemBids } from "./get-item-bids";
import type { Bid, BidRepository, CreateBidInput } from "@/domain/repositories/bid-repository";
import type { UserProfile, UserRepository } from "@/domain/repositories/user-repository";
import type { LockedBidItem } from "@/domain/repositories/bid-repository";

function makeBid(overrides: Partial<Bid> = {}): Bid {
  return {
    id: "b1",
    itemId: "i1",
    bidderId: "bob",
    bidderName: "bob",
    amount: 5000,
    rank: 1,
    createdAt: new Date(),
    ...overrides,
  };
}

const bob: UserProfile = {
  id: "bob",
  name: "Bob Silva",
  email: "bob@ex.com",
  phone: null,
  slug: null,
  address: null,
  role: "bidder",
};

class FakeBidRepository implements BidRepository {
  constructor(private bids: Bid[]) {}
  async findByItemId() {
    return this.bids;
  }
  async placeBid(_input: CreateBidInput, _validate: (ctx: { item: LockedBidItem | null; highestBid: Bid | undefined }) => void): Promise<never> {
    throw new Error("não usado");
  }
  async listByBidder(_bidderId: string): Promise<Bid[]> {
    return [];
  }
}

class FakeUserRepository implements UserRepository {
  userBy: Record<string, UserProfile | null>;
  /** contagem de idas ao banco — e o que o teste de N+1 le */
  findByIdCalls = 0;
  findByIdsCalls: string[][] = [];
  constructor(users: Record<string, UserProfile | null>) {
    this.userBy = users;
  }
  async findById(userId: string) {
    this.findByIdCalls++;
    return this.userBy[userId] ?? null;
  }
  async findByIds(ids: string[]) {
    this.findByIdsCalls.push(ids);
    return ids.map((id) => this.userBy[id]).filter((u): u is NonNullable<typeof u> => Boolean(u));
  }

  async findBySlug() {
    return null;
  }
  updateProfile() {
    return Promise.reject(new Error("não usado"));
  }
  updateRole() {
    return Promise.reject(new Error("não usado"));
  }
}

describe("getItemBids", () => {
  it("substitui bidderName pelo nome real do usuário", async () => {
    const bids = [makeBid()];
    const result = await getItemBids(new FakeBidRepository(bids), new FakeUserRepository({ bob }), "i1");
    expect(result[0]?.bidderName).toBe("Bob Silva");
  });

  it("mantém bidderId quando o usuário não é encontrado", async () => {
    const bids = [makeBid({ bidderId: "desconhecido", bidderName: "desconhecido" })];
    const result = await getItemBids(new FakeBidRepository(bids), new FakeUserRepository({}), "i1");
    expect(result[0]?.bidderName).toBe("desconhecido");
  });

  it("preserva a ordem do repositório", async () => {
    const bids = [
      makeBid({ id: "b1", bidderId: "bob", amount: 5000 }),
      makeBid({ id: "b2", bidderId: "ana", amount: 4800 }),
      makeBid({ id: "b3", bidderId: "carol", amount: 4500 }),
    ];
    const result = await getItemBids(new FakeBidRepository(bids), new FakeUserRepository({}), "i1");
    expect(result.map((b) => b.id)).toEqual(["b1", "b2", "b3"]);
  });
});

// ponytail: o `Promise.all` sobre `findById` PARECIA concorrente, mas continuava
// sendo N idas ao banco. O polling publico da vitrine roda a cada 10s e nao
// exige sessao, entao um item com 300 lances virava 301 queries por ciclo contra
// o pool de 10 conexoes do `pg` — e, como o pool e um singleton de modulo
// compartilhado com o dashboard, a aba de um visitante anonimo segurava as
// paginas autenticadas dos outros. Estes testes medem a CONTAGEM, e nao so o
// resultado: um teste que so conferisse os nomes passaria com o N+1 intacto.
describe("getItemBids — sem N+1 na resolucao dos nomes", () => {
  const carol: UserProfile = { ...bob, id: "carol", name: "Carol Souza" };
  const ana: UserProfile = { ...bob, id: "ana", name: "Ana Lima" };

  it("resolve 300 lances com UMA consulta de usuarios, nao 300", async () => {
    const bids = Array.from({ length: 300 }, (_, i) =>
      makeBid({ id: `b${i}`, bidderId: i % 2 === 0 ? "bob" : "carol" }),
    );
    const users = new FakeUserRepository({ bob, carol });

    const result = await getItemBids(new FakeBidRepository(bids), users, "i1");

    expect(result).toHaveLength(300);
    expect(users.findByIdCalls).toBe(0);
    // uma unica ida, e so com os ids DISTINTOS (bob e carol, nao 300 repetidos)
    expect(users.findByIdsCalls).toEqual([["bob", "carol"]]);
    expect(result[0]?.bidderName).toBe("Bob Silva");
    expect(result[1]?.bidderName).toBe("Carol Souza");
  });

  it("pede cada pessoa uma vez so, mesmo com varios lances dela", async () => {
    const bids = [
      makeBid({ id: "b1", bidderId: "bob" }),
      makeBid({ id: "b2", bidderId: "bob" }),
      makeBid({ id: "b3", bidderId: "ana" }),
    ];
    const users = new FakeUserRepository({ bob, ana });

    await getItemBids(new FakeBidRepository(bids), users, "i1");

    expect(users.findByIdsCalls).toEqual([["bob", "ana"]]);
  });

  it("nao consulta o banco quando nao ha lance nenhum", async () => {
    const users = new FakeUserRepository({ bob });
    await expect(getItemBids(new FakeBidRepository([]), users, "i1")).resolves.toEqual([]);
    expect(users.findByIdsCalls).toEqual([]);
  });

  it("mantem o bidderId cru quando a pessoa nao volta na consulta", async () => {
    const bids = [makeBid({ id: "b1", bidderId: "sumiu", bidderName: "sumiu" })];
    const users = new FakeUserRepository({});
    const result = await getItemBids(new FakeBidRepository(bids), users, "i1");
    expect(result[0]?.bidderName).toBe("sumiu");
  });
});
