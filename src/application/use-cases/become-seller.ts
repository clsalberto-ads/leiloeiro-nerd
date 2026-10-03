import { createSlug } from "@/domain/value-objects/slug";
import type { UserProfile, UserRepository } from "@/domain/repositories/user-repository";

export type SellerRole = "seller" | "both";

export async function becomeSeller(
  userRepo: UserRepository,
  userId: string,
  input: { slug: string; role: SellerRole },
): Promise<UserProfile> {
  // ponytail: o `createSlug` roda ANTES de tudo, mesmo quando o resultado sera
  // descartado — e o que mantem "payload invalido" como erro em qualquer
  // caminho. Se o `findById` viesse antes, um `POST` de quem ja tem slug passaria.
  const slug = createSlug(input.slug);

  // ponytail: este use case ATIVA a vitrine, nao a renomeia. Quem ja tem slug
  // publico mantem o slug e so troca o papel. Sem esta guarda, um `POST` direto
  // na `becomeSellerAction` reescrevia o slug de um seller e quebrava todo link
  // ja divulgado da vitrine — e o slug antigo nao voltava em lugar nenhum. A
  // `dashboard/settings` ja esconde o formulario para quem e seller, mas a
  // action e um endpoint: esconder o botao nunca foi o guard.
  const atual = await userRepo.findById(userId);
  if (atual?.slug) return userRepo.updateRole(userId, input.role, atual.slug);

  return userRepo.updateRole(userId, input.role, slug);
}
