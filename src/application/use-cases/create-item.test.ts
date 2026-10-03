import { describe, expect, it } from "vitest";
import { createItem } from "./create-item";
import type { CreateItemInput, Item, ItemRepository } from "@/domain/repositories/item-repository";
import type { UserProfile, UserRepository } from "@/domain/repositories/user-repository";

const baseUser: UserProfile = {
  id: "u1",
  name: "Ana",
  email: "ana@ex.com",
  phone: null,
  slug: null,
  address: null,
  role: "seller",
};

class FakeUserRepository implements UserRepository {
  constructor(private user: UserProfile | null) {}
  async findById() {
    return this.user;
  }
  async updateProfile(_: string, input: Record<string, unknown>) {
    return { ...this.user!, ...input } as UserProfile;
  }
  async findByIds() {
    return Promise.reject(new Error("não usado"));
  }

  async findBySlug() {
    return null;
  }
  async updateRole() {
    return this.user!;
  }
}

class FakeItemRepository implements ItemRepository {
  captures: (Omit<CreateItemInput, "sellerId"> & { sellerId: string })[] = [];
  imagesCaptures: { itemId: string; urls: string[] }[] = [];
  async create(input: CreateItemInput) {
    this.captures.push(input);
    return {
      id: "i1",
      ...input,
      imageUrl: null,
      paymentDeadlineDays: input.paymentDeadlineDays ?? 3,
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Item;
  }
  async update() {
    return null;
  }
  async findById() {
    return null;
  }
  async findBySellerId() {
    return [];
  }
  async delete() {}
  async closeExpired() {
    return [];
  }
  async updateDraft(): Promise<Item | null> {
    throw new Error("não usado");
  }

  async setStatus() {
    return null;
  }
  async countBids() {
    return 0;
  }
  async findImagesByItemId() {
    return [];
  }
  async findImageById() {
    return null;
  }
  async createImages(itemId: string, urls: string[]) {
    this.imagesCaptures.push({ itemId, urls });
    return [];
  }
  async deleteImage() {}
}

const valid = {
  title: "Action Figure rara",
  description: "Colecionável lacrado, edição limitada.",
  type: "product" as const,
  minInitialBid: 5000,
  minBidIncrement: 500,
  bidDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
};

describe("createItem", () => {
  it("cria item como seller", async () => {
    const userRepo = new FakeUserRepository(baseUser);
    const itemRepo = new FakeItemRepository();
    const item = await createItem(itemRepo, userRepo, baseUser.id, valid);
    expect(item.status).toBe("draft");
    expect(itemRepo.captures[0]?.sellerId).toBe("u1");
  });

  it("registra imageUrls no repositório quando fornecidas", async () => {
    const userRepo = new FakeUserRepository(baseUser);
    const itemRepo = new FakeItemRepository();
    await createItem(itemRepo, userRepo, "u1", { ...valid, imageUrls: ["https://ex.com/a.jpg"] });
    expect(itemRepo.imagesCaptures).toEqual([{ itemId: "i1", urls: ["https://ex.com/a.jpg"] }]);
  });

  it("não chama createImages sem imageUrls", async () => {
    const userRepo = new FakeUserRepository(baseUser);
    const itemRepo = new FakeItemRepository();
    await createItem(itemRepo, userRepo, "u1", valid);
    expect(itemRepo.imagesCaptures).toEqual([]);
  });

  it("aceita usuário com role both", async () => {
    const userRepo = new FakeUserRepository({ ...baseUser, role: "both" });
    const itemRepo = new FakeItemRepository();
    await expect(createItem(itemRepo, userRepo, "u1", valid)).resolves.toBeDefined();
  });

  it("rejeita usuário bidder", async () => {
    const userRepo = new FakeUserRepository({ ...baseUser, role: "bidder" });
    const itemRepo = new FakeItemRepository();
    await expect(createItem(itemRepo, userRepo, "u1", valid)).rejects.toThrow("Apenas leiloeiros podem criar itens");
    expect(itemRepo.captures).toHaveLength(0);
  });

  it("rejeita usuário inexistente", async () => {
    const userRepo = new FakeUserRepository(null);
    const itemRepo = new FakeItemRepository();
    await expect(createItem(itemRepo, userRepo, "u1", valid)).rejects.toThrow("Apenas leiloeiros podem criar itens");
  });

  it("rejeita deadline no passado", async () => {
    const itemRepo = new FakeItemRepository();
    await expect(
      createItem(itemRepo, new FakeUserRepository(baseUser), "u1", {
        ...valid,
        bidDeadline: new Date(Date.now() - 1000),
      }),
    ).rejects.toThrow("Prazo de lances deve ser no futuro");
  });

  it("rejeita valores abaixo de R$ 1,00", async () => {
    const itemRepo = new FakeItemRepository();
    await expect(
      createItem(itemRepo, new FakeUserRepository(baseUser), "u1", { ...valid, minInitialBid: 50 }),
    ).rejects.toThrow("Lance mínimo deve ser de pelo menos R$ 1,00");
  });
});