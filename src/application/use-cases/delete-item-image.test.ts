import { describe, expect, it } from "vitest";
import { deleteItemImage } from "./delete-item-image";
import type { Item, ItemImage, ItemRepository } from "@/domain/repositories/item-repository";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "i1",
    sellerId: "u1",
    title: "Item",
    description: "",
    type: "product",
    imageUrl: null,
    minInitialBid: 100,
    minBidIncrement: 100,
    bidDeadline: new Date(),
    paymentDeadlineDays: 3,
    status: "draft",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeImage(overrides: Partial<ItemImage> = {}): ItemImage {
  return {
    id: "img1",
    itemId: "i1",
    url: "/a.jpg",
    position: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

class FakeItemRepository implements ItemRepository {
  async closeExpired() {
    return [];
  }
  async updateDraft(): Promise<Item | null> {
    throw new Error("não usado");
  }
  deleted: string[] = [];
  constructor(private image: ItemImage | null, private item: Item | null = null) {}
  async findImageById() {
    return this.image;
  }
  async findById() {
    return this.item;
  }
  async deleteImage(imageId: string) {
    this.deleted.push(imageId);
  }
  create() {
    return Promise.reject(new Error("não usado"));
  }
  update() {
    return Promise.reject(new Error("não usado"));
  }
  findBySellerId() {
    return Promise.reject(new Error("não usado"));
  }
  delete() {
    return Promise.reject(new Error("não usado"));
  }
  setStatus() {
    return Promise.reject(new Error("não usado"));
  }
  countBids() {
    return Promise.reject(new Error("não usado"));
  }
  findImagesByItemId() {
    return Promise.reject(new Error("não usado"));
  }
  createImages() {
    return Promise.reject(new Error("não usado"));
  }
}

describe("deleteItemImage", () => {
  it("deleta a imagem quando o item pertence ao usuário", async () => {
    const repo = new FakeItemRepository(makeImage(), makeItem({ sellerId: "u1" }));
    await deleteItemImage(repo, "u1", "img1");
    expect(repo.deleted).toEqual(["img1"]);
  });

  it("rejeita com Sem permissão quando o item pertence a outro seller e não deleta", async () => {
    const repo = new FakeItemRepository(makeImage(), makeItem({ sellerId: "outro" }));
    await expect(deleteItemImage(repo, "u1", "img1")).rejects.toThrow("Sem permissão");
    expect(repo.deleted).toEqual([]);
  });

  it("rejeita com Imagem não encontrada e não deleta", async () => {
    const repo = new FakeItemRepository(null);
    await expect(deleteItemImage(repo, "u1", "img-inexistente")).rejects.toThrow("Imagem não encontrada");
    expect(repo.deleted).toEqual([]);
  });

  // ponytail: a posse sozinha NAO basta. `updateItem` e `deleteItem` ja recusavam
  // qualquer coisa depois de `draft`; esta use case conferia so o `sellerId`, e
  // o unico obstaculo entre o vendedor e as fotos de um item ja arrematado era o
  // `disabled={locked}` do botao — cliente, e a action e um endpoint. Este teste
  // e o que fecha a porta se o gate de status sair de la.
  it("recusa apagar imagens de item publicado, mesmo do proprio dono, e não deleta", async () => {
    for (const status of ["active", "closed", "awaiting_payment", "paid", "cancelled"] as const) {
      const repo = new FakeItemRepository(makeImage(), makeItem({ sellerId: "u1", status }));
      await expect(deleteItemImage(repo, "u1", "img1")).rejects.toThrow(
        "Imagens de item publicado não podem ser excluídas",
      );
      expect(repo.deleted).toEqual([]);
    }
  });
});