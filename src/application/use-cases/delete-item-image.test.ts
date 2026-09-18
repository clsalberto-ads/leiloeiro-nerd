import { describe, expect, it } from "vitest";
import { deleteItemImage } from "./delete-item-image";
import type { ItemRepository } from "@/domain/repositories/item-repository";

class FakeItemRepository implements ItemRepository {
  deleted: string[] = [];
  async deleteImage(imageId: string) {
    this.deleted.push(imageId);
  }
  create() {
    return Promise.reject(new Error("não usado"));
  }
  update() {
    return Promise.reject(new Error("não usado"));
  }
  findById() {
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
  it("deleta a imagem chamando deleteImage com o imageId", async () => {
    const repo = new FakeItemRepository();
    await deleteItemImage(repo, "u1", "img1");
    expect(repo.deleted).toEqual(["img1"]);
  });

  it("resolve sem lançar quando o repositório confirma a exclusão", async () => {
    await expect(deleteItemImage(new FakeItemRepository(), "u1", "img1")).resolves.toBeUndefined();
  });
});