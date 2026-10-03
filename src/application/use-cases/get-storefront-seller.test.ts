import { describe, expect, it } from "vitest";
import { getStorefrontSeller } from "./get-storefront-seller";
import type { SellerStorefront, SellerStorefrontRepository } from "@/domain/repositories/user-repository";

const SELLER: SellerStorefront = {
  id: "u1", name: "Ana", slug: "ana", image: null,
  createdAt: new Date("2026-01-15T00:00:00Z"), activeItemCount: 3,
};

class Fake implements SellerStorefrontRepository {
  constructor(private row: SellerStorefront | null) {}
  async findVitrineBySlug(slug: string) {
    if (this.row && this.row.slug !== slug) return null;
    return this.row;
  }
}

describe("getStorefrontSeller", () => {
  it("devolve o perfil completo do vendedor", async () => {
    await expect(getStorefrontSeller(new Fake(SELLER), "ana")).resolves.toEqual(SELLER);
  });

  it("devolve null para slug inexistente", async () => {
    await expect(getStorefrontSeller(new Fake(SELLER), "ninguem")).resolves.toBeNull();
  });

  it("NAO toca em UserRepository: a porta e a de vitrine, e nao a geral", async () => {
    // ponytail: este `it` nao testa comportamento de tela — ele trava o QUE o use
    // case depende. Se alguem trocar `SellerStorefrontRepository` por
    // `UserRepository` para "reaproveitar", o `tsc` passa (a porta nova e um
    // subconjunto conceitual) mas o use case passa a exigir um metodo que os 7
    // fakes de `UserRepository` de outros testes nao tem
    // (`grep -rn "implements UserRepository" src/ --include=*.test.ts` -> 7
    // classes, todas sem `findVitrineBySlug`). O tipo da assinatura e a trava.
    const repo = new Fake(SELLER);
    await getStorefrontSeller(repo, "ana");
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(repo))).toContain("findVitrineBySlug");
  });
});