import type { UserRepository } from "@/domain/repositories/user-repository";

export async function getSellerBySlug(
  userRepo: UserRepository,
  slug: string,
): Promise<{ id: string; name: string; slug: string } | null> {
  return userRepo.findBySlug(slug);
}