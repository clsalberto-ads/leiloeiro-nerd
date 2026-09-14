import { describe, expect, it } from "vitest";
import { updateProfile } from "./update-profile";
import type { UpdateProfileInput, UserProfile, UserRepository } from "@/domain/repositories/user-repository";

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
  calls: UpdateProfileInput[] = [];
  async updateProfile(_: string, input: UpdateProfileInput): Promise<UserProfile> {
    this.calls.push(input);
    return { ...baseUser, ...input };
  }
  async findBySlug() {
    return null;
  }
}

describe("updateProfile", () => {
  it("normaliza o slug antes de persistir", async () => {
    const repo = new FakeUserRepository();
    await updateProfile(repo, "u1", { slug: "Loja do Nerd" });
    expect(repo.calls[0]!.slug).toBe("loja-do-nerd");
  });

  it("persiste os campos informados", async () => {
    const repo = new FakeUserRepository();
    const result = await updateProfile(repo, "u1", { name: "Ana B.", phone: "+55 11 99999-0000" });
    expect(result.name).toBe("Ana B.");
    expect(result.phone).toBe("+55 11 99999-0000");
  });

  it("rejeita slug inválido", async () => {
    const repo = new FakeUserRepository();
    await expect(updateProfile(repo, "u1", { slug: "!!" })).rejects.toThrow();
    expect(repo.calls).toHaveLength(0);
  });

  it("não persiste strings vazias em slug/phone/address (trata como não enviado)", async () => {
    const repo = new FakeUserRepository();
    await updateProfile(repo, "u1", { slug: "", phone: "", address: "" });
    expect(repo.calls[0]!.slug).toBeUndefined();
    expect(repo.calls[0]!.phone).toBeUndefined();
    expect(repo.calls[0]!.address).toBeUndefined();
  });
});