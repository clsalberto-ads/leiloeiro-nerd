import { describe, expect, it, vi } from "vitest";

import { updateProfile } from "./update-profile";
import type { UpdateProfileInput, UserProfile } from "@/domain/repositories/user-repository";

const SLUG_LONGO = "x".repeat(70);

type Role = UserProfile["role"];

function repo(role: Role = "bidder") {
  const updateProfile = vi.fn(async (userId: string, _input: UpdateProfileInput) => ({
    id: userId, name: "Ana", email: "ana@ex.com", phone: null, slug: null, address: null, role: role,
  }));
  const findById = vi.fn(async (_id: string): Promise<UserProfile> => ({
    id: "u1", name: "Ana", email: "ana@ex.com", phone: null, slug: null, address: null, role: role,
  }));
  // ponytail: o `spy` e a MESMA funcao que vai no `updateProfile` do contrato, e
  // nao um wrapper. Um wrapper guardaria os calls em dois lugares e o teste
  // passaria olhando o espelho, nao o que o use case realmente gravou — que e
  // justo o que esta sendo auditado aqui.
  return Object.assign(
    {
      async findBySlug() {
        return null;
      },
      async findByIds() {
        return [];
      },
      async updateRole() {
        return findById("u1");
      },
    },
    { updateProfile, findById, spy: updateProfile },
  );
}

// ponytail: o `slug` e a vitrine PUBLICA. `becomeSeller` existe para transformar
// comprador em vendedor, e e a unica porta que deveria mudar o papel — mas o
// `updateProfile` tem um `slug` visivel e `repo.updateProfile` o grava
// sem olhar o papel. Um `bidder` que faca POST direto fica com `slug`
// publicado e, como `users.slug` e UNIQUE e nada o libera, o nome fica squateado: o
// vendedor legitimo leva `404` para sempre.
describe("updateProfile — o slug e porta do becomeSeller, nao do perfil", () => {
  it("bidder que manda slug nao publica vitrine", async () => {
    const r = repo("bidder");

    await updateProfile(r, "u1", { name: "Ana", slug: "loja-do-joao" });

    const [, input] = r.spy.mock.calls[0];
    expect(input).not.toHaveProperty("slug");
  });

  it("vendedor pode trocar o proprio slug", async () => {
    const r = repo("seller");

    await updateProfile(r, "u1", { slug: "loja-da-ana" });

    expect(r.spy).toHaveBeenCalledWith("u1", expect.objectContaining({ slug: "loja-da-ana" }));
  });

  it("'both' tambem pode", async () => {
    const r = repo("both");

    await updateProfile(r, "u1", { slug: "ana-leila" });

    expect(r.spy).toHaveBeenCalledWith("u1", expect.objectContaining({ slug: "ana-leila" }));
  });

  // ponytail: com o slug barrado, o `slugSchema` nao deve rodar sobre ele — um
  // slug de 70 chars lancaria "Slug excede 60 caracteres" e derrubaria a gravacao
  // INTEIRA, descartando nome/celular/endereco que o usuario queria salvar.
  it("slug invalido de bidder nao derruba o resto do perfil", async () => {
    const r = repo();

    await expect(updateProfile(r, "u1", { name: "Ana Impala", slug: SLUG_LONGO })).resolves.toBeDefined();
    expect(r.spy).toHaveBeenCalledWith("u1", expect.objectContaining({ name: "Ana Impala" }));
  });

  it("slug invalido de vendedor continua dando o erro especifico", async () => {
    const r = repo("seller");

    await expect(updateProfile(r, "u1", { slug: SLUG_LONGO })).rejects.toThrow(/60 caracteres/);
  });
});

// ponytail: `phone`/`address` sao `null` na entidade, mas o contrato de
// escrita nao tem `null` — e "" e filtrado como "nao enviado". Limpar o campo
// (pedido de LGPD) produz `""`, que nunca chega ao banco: o dado antigo fica
// preso para sempre, sem como expressar "apague".
describe("updateProfile — campo opcional pode ser limpo", () => {
  it("phone vazio vira null, e nao 'nao mexer'", async () => {
    const r = repo("seller");

    await updateProfile(r, "u1", { phone: "" });

    expect(r.spy).toHaveBeenCalledWith("u1", expect.objectContaining({ phone: null }));
  });

  it("address vazio vira null", async () => {
    const r = repo("seller");

    await updateProfile(r, "u1", { address: "" });

    expect(r.spy).toHaveBeenCalledWith("u1", expect.objectContaining({ address: null }));
  });

  it("name vazio continua sendo 'nao mexer' (nao se apaga um nome)", async () => {
    const r = repo("seller");

    await updateProfile(r, "u1", { name: "" });

    const [, input] = r.spy.mock.calls[0];
    expect(input).not.toHaveProperty("name");
  });
});
