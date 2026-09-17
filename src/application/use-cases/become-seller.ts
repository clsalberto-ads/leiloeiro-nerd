import { createSlug } from "@/domain/value-objects/slug";
import type { UserProfile, UserRepository } from "@/domain/repositories/user-repository";

export type SellerRole = "seller" | "both";

export async function becomeSeller(
  userRepo: UserRepository,
  userId: string,
  input: { slug: string; role: SellerRole },
): Promise<UserProfile> {
  const slug = createSlug(input.slug);
  return userRepo.updateRole(userId, input.role, slug);
}
