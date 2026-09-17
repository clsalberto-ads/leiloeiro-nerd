import { describe, expect, it } from "vitest";
import { becomeSeller } from "./become-seller";
import type { UserProfile, UserRepository } from "@/domain/repositories/user-repository";

const baseUser: UserProfile = {
  id: "u1",
  name: "Ana",
  email: "ana@ex.com",
  phone: null,
  slug: null,
  address: null,
  role: "bidder",
};

class FakeUserRepository implements UserRepository {
  constructor(public current: UserProfile = baseUser) {}
  async findById() {
    return this.current;
  }
  async updateProfile(_: string, input: Record<string, unknown>) {
    return { ...this.current, ...input } as UserProfile;
  }
  async findBySlug() {
    return null;
  }
  async updateRole(_: string, role: UserProfile["role"], slug: string) {
    this.current = { ...this.current, role, slug };
    return this.current;
  }
}

describe("becomeSeller", () => {
  it("normaliza o slug e promove o papel para seller", async () => {
    const repo = new FakeUserRepository();
    const user = await becomeSeller(repo, "u1", { slug: "Loja do Nerd", role: "seller" });
    expect(user.role).toBe("seller");
    expect(user.slug).toBe("loja-do-nerd");
  });

  it("permite papel both", async () => {
    const repo = new FakeUserRepository();
    const user = await becomeSeller(repo, "u1", { slug: "nerd-colecionaveis", role: "both" });
    expect(user.role).toBe("both");
  });

  it("rejeita slug inválido antes de persistir", async () => {
    const repo = new FakeUserRepository();
    await expect(becomeSeller(repo, "u1", { slug: "!!", role: "seller" })).rejects.toThrow();
    expect(repo.current.slug).toBeNull();
  });
});
