import { describe, expect, it } from "vitest";
import { getVitrineSeller } from "./get-vitrine-seller";
import type { VitrineDeVendedor, VitrineDeVendedorRepository } from "@/domain/repositories/user-repository";

const VENDEDOR: VitrineDeVendedor = {
  id: "u1", name: "Ana", slug: "ana", image: null,
  criadoEm: new Date("2026-01-15T00:00:00Z"), totalDeItensAtivos: 3,
};

class Fake implements VitrineDeVendedorRepository {
  constructor(private row: VitrineDeVendedor | null) {}
  async findVitrineBySlug(slug: string) {
    if (this.row && this.row.slug !== slug) return null;
    return this.row;
  }
}

describe("getVitrineSeller", () => {
  it("devolve o perfil completo do vendedor", async () => {
    await expect(getVitrineSeller(new Fake(VENDEDOR), "ana")).resolves.toEqual(VENDEDOR);
  });

  it("devolve null para slug inexistente", async () => {
    await expect(getVitrineSeller(new Fake(VENDEDOR), "ninguem")).resolves.toBeNull();
  });

  it("NAO toca em UserRepository: a porta e a de vitrine, e nao a geral", async () => {
    // ponytail: este `it` nao testa comportamento de tela — ele trava o QUE o use
    // case depende. Se alguem trocar `VitrineDeVendedorRepository` por
    // `UserRepository` para "reaproveitar", o `tsc` passa (a porta nova e um
    // subconjunto conceitual) mas o use case passa a exigir um metodo que os 7
    // fakes de `UserRepository` de outros testes nao tem
    // (`grep -rn "implements UserRepository" src/ --include=*.test.ts` -> 7
    // classes, todas sem `findVitrineBySlug`). O tipo da assinatura e a trava.
    const repo = new Fake(VENDEDOR);
    await getVitrineSeller(repo, "ana");
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(repo))).toContain("findVitrineBySlug");
  });
});