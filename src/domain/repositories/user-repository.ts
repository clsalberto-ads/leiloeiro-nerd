export type UserRole = "seller" | "bidder" | "both";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  slug: string | null;
  address: string | null;
  role: UserRole;
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
  slug?: string;
  address?: string;
}

export interface UserRepository {
  updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile>;
  findBySlug(slug: string): Promise<{ id: string; name: string; slug: string } | null>;
  findById(userId: string): Promise<UserProfile | null>;
  /**
   * many(ids) em UMA consulta. Existe pelo `resolveBidderNames`, que antes
   * chamava `findById` uma vez por lance: o polling publico da vitrine roda a
   * cada 10s e, num item com 300 lances, virava 301 idas ao banco contra um
   * pool de 10 conexoes — com a aba de qualquer visitante Anonymous ableando
   * as paginas autenticadas. `ids` vazio devolve `[]` sem tocar no banco.
   */
  findByIds(ids: string[]): Promise<UserProfile[]>;
  updateRole(userId: string, role: UserRole, slug: string): Promise<UserProfile>;
}

// ponytail: o perfil que o HERO da vitrine precisa, e uma porta separada porque
// `findBySlug` nao pode mudar de forma: o `get-seller-by-slug.test.ts:32` faz
// `toEqual(sellerRow)` sobre `{id, name, slug}`, e 7 fakes de `UserRepository`
// implementam esse retorno (contados em `grep -rn "implements UserRepository"
// src/ --include=*.test.ts` -> 7 classes, nenhuma com `findVitrineBySlug`).
// Acrescentar `image`/`createdAt`/`activeItemCount` ali quebraria os sete.
// E o mesmo motivo do `ItemLister`.
//
// Os tres campos novos sao os que `user` JA tem (`image`, `created_at`) ou o que
// se deriva com um `count` (`activeItemCount`) — nenhum exige migration.
export interface SellerStorefront {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  createdAt: Date;
  activeItemCount: number;
}

export interface SellerStorefrontRepository {
  findVitrineBySlug(slug: string): Promise<SellerStorefront | null>;
}