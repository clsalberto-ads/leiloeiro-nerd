import { createSlug } from "@/domain/value-objects/slug";
import type { UpdateProfileInput, UserProfile, UserRepository } from "@/domain/repositories/user-repository";

export async function updateProfile(
  repo: UserRepository,
  userId: string,
  input: UpdateProfileInput,
): Promise<UserProfile> {
  const fields = Object.fromEntries(
    Object.entries(input).filter(([, value]) => !(typeof value === "string" && value.trim() === "")),
  ) as UpdateProfileInput;
  const slug = fields.slug ? createSlug(fields.slug) : fields.slug;
  return repo.updateProfile(userId, { ...fields, slug });
}