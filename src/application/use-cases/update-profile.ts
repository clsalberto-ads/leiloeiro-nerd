import { createSlug } from "@/domain/value-objects/slug";
import type { UpdateProfileInput, UserProfile, UserRepository } from "@/domain/repositories/user-repository";

// Papéis que podem ter vitrine publica. Espelha `ROLES_WITH_STOREFRONT` de create-item.
const ROLES_WITH_STOREFRONT = new Set(["seller", "both"]);

// ponytail: campo que o usuario LIMPA precisa virar `null`, e nao sumir do
// update. `phone`/`address` sao `null` na entidade e existe caminho de
// UI para o usuario querer apagar o que gravou (pedido de LGPD). A traducao
// antiga tratava `""` como "nao enviado" para todos os campos — o que resolve o
// `name` intocado mas torna o campo IMPOSSIVEL de apagar: o `null` nunca
// chegava ao banco e o valor antigo ficava preso.
//
// `name` e `slug` ficam de fora de proposito: um nome nao se apaga, e o slug nao
// se libera (e a vitrine).
const CAMPOS_APAGAVEIS = new Set(["phone", "address"]);

export async function updateProfile(
  repo: UserRepository,
  userId: string,
  input: UpdateProfileInput,
): Promise<UserProfile> {
  const { slug: slugEnviado, ...resto } = input;

  const fields = Object.fromEntries(
    Object.entries(resto).map(([campo, value]) => {
      if (typeof value !== "string") return [campo, value];
      const limpo = value.trim();
      // campo apagavel: vazio vira null (apaga). campo normal: vazio some
      // (nao mexe).
      if (limpo === "") return [campo, CAMPOS_APAGAVEIS.has(campo) ? null : undefined];
      return [campo, limpo];
    }).filter(([, value]) => value !== undefined),
  ) as UpdateProfileInput;

  // ponytail: o `slug` e a vitrine PUBLICA, e `becomeSeller` existe para ser a
  // unica porta que cria uma. O `updateProfile` tem um `slug`
  // visivel, mas `updateProfile` nao pode blindly gravar: sem esta checagem um
  // `bidder` que faca POST direto publica `slug`, e como `users.slug` e UNIQUE e
  // nao existe caminho para libera-lo, o nome fica squateado — o vendedor
  // legitimo leva `404` para sempre.
  //
  // E o `createSlug` so roda DEPOIS da checagem de papel: um slug de 70 chars
  // de um bidder lancaria "excede 60 caracteres" e derrubaria a gravacao
  // inteira, descartando o nome/celular/endereco que ele queria salvar.
  let slug: string | undefined;
  if (typeof slugEnviado === "string" && slugEnviado.trim() !== "") {
    const perfil = await repo.findById(userId);
    if (perfil && ROLES_WITH_STOREFRONT.has(perfil.role)) slug = createSlug(slugEnviado);
  }

  return repo.updateProfile(userId, slug === undefined ? fields : { ...fields, slug });
}
