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