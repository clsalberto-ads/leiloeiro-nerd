import { MAX_SLUG_LENGTH } from "@/lib/constants";

const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createSlug(raw: string): string {
  const slug = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length === 0) throw new Error("Slug não pode ser vazio");
  if (slug.length > MAX_SLUG_LENGTH) throw new Error("Slug excede 60 caracteres");
  if (!VALID_SLUG.test(slug)) throw new Error("Slug contém caracteres inválidos");
  return slug;
}