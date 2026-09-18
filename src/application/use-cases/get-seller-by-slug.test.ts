import { describe, expect, it } from "vitest";
import { getSellerBySlug } from "./get-seller-by-slug";
import type { UserRepository } from "@/domain/repositories/user-repository";

const sellerRow = { id: "u1", name: "Ana", slug: "ana-impala" };

class FakeUserRepository implements UserRepository {
  captured: string[] = [];
  constructor(private row: { id: string; name: string; slug: string } | null) {}
  async findBySlug(slug: string) {
    this.captured.push(slug);
    return this.row;
  }
  async findById() {
    return null;
  }
  async updateProfile() {
    return Promise.reject(new Error("não usado"));
  }
  async updateRole() {
    return Promise.reject(new Error("não usado"));
  }
}

describe("getSellerBySlug", () => {
  it("retorna o seller quando encontrado", async () => {
    const repo = new FakeUserRepository(sellerRow);
    await expect(getSellerBySlug(repo, "ana-impala")).resolves.toEqual(sellerRow);
  });

  it("retorna null quando o slug não existe", async () => {
    const repo = new FakeUserRepository(null);
    await expect(getSellerBySlug(repo, "nao-existe")).resolves.toBeNull();
  });

  it("repassa o slug para o repositório", async () => {
    const repo = new FakeUserRepository(sellerRow);
    await getSellerBySlug(repo, "ana-impala");
    expect(repo.captured).toEqual(["ana-impala"]);
  });
});