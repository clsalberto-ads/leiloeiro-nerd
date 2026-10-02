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

// ponytail: o papel e parametrizavel porque o `slug` so e persistido para quem
// tem vitrine (`seller`/`both`). Com `role` fixo, o teste "normaliza o slug"
// passaria a verificar que o slug foi DESCARTADO — que e o comportamento novo e
// correto, mas nao o que o nome do caso promete.
function user(role: UserProfile["role"] = "bidder"): UserProfile {
  return { ...baseUser, role };
}

class FakeUserRepository implements UserRepository {
  calls: UpdateProfileInput[] = [];
  constructor(private role: UserProfile["role"] = "bidder") {}
  async updateProfile(_: string, input: UpdateProfileInput): Promise<UserProfile> {
    this.calls.push(input);
    return { ...user(this.role), ...input };
  }
  async findByIds() {
    return Promise.reject(new Error("não usado"));
  }

  async findBySlug() {
    return null;
  }
  async findById() {
    return user(this.role);
  }
  async updateRole() {
    return user(this.role);
  }
}

describe("updateProfile", () => {
  it("normaliza o slug antes de persistir", async () => {
    const repo = new FakeUserRepository("seller");
    await updateProfile(repo, "u1", { slug: "Loja do Nerd" });
    expect(repo.calls[0]!.slug).toBe("loja-do-nerd");
  });

  // ponytail: o `slug` e a vitrine PUBLICA e `becomeSeller` existe para ser a
  // unica porta que cria uma. Um `bidder` fazendo POST direto nao deve publicar
  // `slug` — e como `users.slug` e UNIQUE e nada o libera, publicar seria
  // squatear o nome para sempre.
  it("bidder nao publica vitrine pelo campo slug", async () => {
    const repo = new FakeUserRepository("bidder");
    await updateProfile(repo, "u1", { slug: "loja-do-joao" });
    expect(repo.calls[0]!.slug).toBeUndefined();
  });

  it("persiste os campos informados", async () => {
    const repo = new FakeUserRepository();
    const result = await updateProfile(repo, "u1", { name: "Ana B.", phone: "+55 11 99999-0000" });
    expect(result.name).toBe("Ana B.");
    expect(result.phone).toBe("+55 11 99999-0000");
  });

  it("rejeita slug inválido", async () => {
    const repo = new FakeUserRepository("seller");
    await expect(updateProfile(repo, "u1", { slug: "!!" })).rejects.toThrow();
    expect(repo.calls).toHaveLength(0);
  });

  // ponytail: `slug` empty e "nao mexe" (vitrine nao se libera), mas `phone` e
  // `address` vazios sao "APAGUE". Sao `null` na entidade e existe
  // caminho de UI para o usuario querer remover o que gravou — tratar `""` como
  // ausente nesses dois tornava o campo IMPOSSIVEL de apagar, com o valor
  // antigo preso no banco sem nenhuma forma de expressar a limpeza.
  it("slug vazio e 'nao mexe', mas phone/address vazios APAGAM (viram null)", async () => {
    const repo = new FakeUserRepository("seller");
    await updateProfile(repo, "u1", { slug: "", phone: "", address: "" });
    expect(repo.calls[0]!.slug).toBeUndefined();
    expect(repo.calls[0]!.phone).toBeNull();
    expect(repo.calls[0]!.address).toBeNull();
  });
});