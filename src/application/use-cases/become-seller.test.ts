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
  async findByIds() {
    return Promise.reject(new Error("não usado"));
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

    // ponytail: `becomeSeller` e a porta que ATIVA a vitrine, nao a porta que
    // RENOMEIA ela. A `dashboard/settings` esconde o form para quem ja e
    // vendedor, mas a action e um endpoint POST — um vendedor que chamasse
    // `becomeSellerAction` direto trocava o proprio slug publico e quebrava
    // todo link ja divulgado da vitrine (`loja-do-nerd/item1`), sem aviso e sem
    // volta: o slug antigo nao volta em lugar nenhum.
    //
    // Quem ja tem slug mantem o slug e so muda o papel. O `createSlug` do input
    // continua rodando (um payload invalido ainda e recusado) mas o resultado
    // nao e gravado.
    it("nao renomeia a vitrine de quem ja tem slug", async () => {
      const repo = new FakeUserRepository({ ...baseUser, role: "seller", slug: "loja-do-nerd" });
      const user = await becomeSeller(repo, "u1", { slug: "outro-nome", role: "both" });
      expect(user.slug).toBe("loja-do-nerd");
      expect(user.role).toBe("both");
    });

    it("ainda recusa payload invalido mesmo quando o slug sera preservado", async () => {
      const repo = new FakeUserRepository({ ...baseUser, role: "seller", slug: "loja-do-nerd" });
      await expect(becomeSeller(repo, "u1", { slug: "!!", role: "seller" })).rejects.toThrow();
      expect(repo.current.slug).toBe("loja-do-nerd");
    });
});
