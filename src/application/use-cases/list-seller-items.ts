import type { ItemListFilter, ItemLister, ItemListResult } from "@/domain/repositories/item-repository";

// ponytail: normalizar aqui, e nao no repositorio, porque a regra "o que significa
// um numero que nao faz sentido" e do CONTRATO — quem implementa `ItemLister` (o
// Drizzle hoje, um indice de busca amanha) nao deve ter de reinventar "limit 2.9" e
// "offset -1" quando a origem e um `searchParams` digitado a mao. O filtro so
// chega inteiro: `limit` inteiro positivo, `offset` inteiro nao negativo e `q` sem
// espaco nas pontas. Devolve o MESMO objeto quando nao ha nada para arrumar, para o
// chamador continuar podendo comparar por identidade.
function normalizar(filter?: ItemListFilter): ItemListFilter | undefined {
  if (!filter) return undefined;
  const q = filter.q?.trim();
  const limite = normalizeLimit(filter.limit);
  const deslocamento = normalizeOffset(filter.offset);
  if (q === filter.q && limite === filter.limit && deslocamento === filter.offset) return filter;
  const limpo: ItemListFilter = { ...filter };
  if (q) limpo.q = q;
  else delete limpo.q;
  if (limite === undefined) delete limpo.limit;
  else limpo.limit = limite;
  if (deslocamento === undefined) delete limpo.offset;
  else limpo.offset = deslocamento;
  return limpo;
}

// ponytail: `Math.trunc` e o que impede o `LIMIT 2.9` (erro do Postgres: "LIMIT must
// not have a decimal"). Os doisTem piso, e o piso e diferente porque o zero significa
// coisas diferentes em cada um: `limit 0` seria "zero itens", que ninguem quer e nao e
// "todos" — some; `offset 0` e "a partir do primeiro", que e a pagina 1 e a forma
// canonica de ela ser pedida, entao fica. Um `offset` negativo tambem nao e pagina -1:
// e erro de SQL, entao e apeado para 0.
function normalizeLimit(value?: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const int = Math.trunc(value);
  return int > 0 ? int : undefined;
}

function normalizeOffset(value?: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.trunc(value));
}

export async function listSellerItems(
  itemRepo: ItemLister,
  sellerId: string,
  filter?: ItemListFilter,
): Promise<ItemListResult> {
  return itemRepo.listBySellerId(sellerId, normalizar(filter));
}
