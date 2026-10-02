import type { SellerStorefront, SellerStorefrontRepository } from "@/domain/repositories/user-repository";

// ponytail: este use case nao tem regra nenhuma — ele repassa a chamada. Ele
// existe pela MESMA razao que `getSellerBySlug` existe: a pagina nao importa
// `src/infrastructure` (a seta da Clean Architecture) e nao deve montar o
// repositorio, e tambem nao deve chamar o `@base-ui` do Next direto no
// componente. E a costura onde o `notFound()` do shell vai ler.
export async function getStorefrontSeller(
  repo: SellerStorefrontRepository,
  slug: string,
): Promise<SellerStorefront | null> {
  return repo.findVitrineBySlug(slug);
}