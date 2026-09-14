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
}