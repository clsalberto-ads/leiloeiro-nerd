import { createSlug } from "@/domain/value-objects/slug";
import type { UpdateProfileInput, UserProfile, UserRepository } from "@/domain/repositories/user-repository";

export async function updateProfile(
  repo: UserRepository,
  userId: string,
  input: UpdateProfileInput,
): Promise<UserProfile> {
  const slug = input.slug ? createSlug(input.slug) : input.slug;
  return repo.updateProfile(userId, { ...input, slug });
}