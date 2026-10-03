import type { ItemRepository } from "@/domain/repositories/item-repository";

/**
 * Encerra os itens cujo prazo de lances passou.
 *
 * ponytail: `closed` estava no enum `item_status` desde o inicio e NENHUM
 * codigo o produzia — a unica transicao escrita era `draft -> active`
 * (`publishItem`). Consequencia: um item expirado continuava `active` para
 * sempre, e como as contagens, o valor listado e as vitrines leem o status, um
 * leilao encerrado aparecia como "Em leilao" e continuava somando dinheiro no
 * painel de quem vendeu. Nao ha como corrigir isso na leitura sem mentir sobre o
 * que esta gravado no banco; a transicao precisava existir.
 *
 * Por que `Date.now()` e parametro opcional: o use case nao deve depender do
 * relogio para ser testavel, e o worker passa o mesmo instante para todos os
 * itens de uma execucao — se cada chamada usasse `Date.now()` no meio, dois
 * itens na fronteira cairiam em dias diferentes dentro do mesmo job.
 */
export async function closeExpiredItems(
  itemRepo: ItemRepository,
  now: Date = new Date(),
): Promise<string[]> {
  return itemRepo.closeExpired(now);
}
