import type { BidStatsList } from "@/domain/repositories/bid-repository";
import type { ExploreItemRow, ExploreLister } from "@/domain/repositories/item-repository";

// ponytail: a linha que o card da vitrine precisa. `ExploreItemRow` (do
// `ExploreLister`) já traz o slug do vendedor e os campos de exibição; aqui só
// acrescenta os agregados de lance que o card mostra ("Lance atual" / "N lances"),
// vindos de UMA consulta em lote (`ofManyItems`), não de uma subquery por item.
export interface ExploreItem extends ExploreItemRow {
  totalBids: number;
  highestBid: number | null;
}

/**
 * Lista todos os itens ativos do site, com o slug do vendedor e os agregados de
 * lance. Serve a página "Descobrir" (`/explore`), que separa o resultado em
 * "terminando em breve", "mais recentes" e "destaques" — a ordenação é decisão
 * da tela, e não deste caso de uso: o conjunto é o mesmo, só muda o comparador.
 */
export async function listExploreItems(
  exploreLister: ExploreLister,
  bidStats: BidStatsList,
): Promise<ExploreItem[]> {
  const rows = await exploreLister.listActiveWithSeller();
  if (rows.length === 0) return [];

  const stats = await bidStats.ofManyItems(rows.map((r) => r.id));

  return rows.map((row) => {
    const stat = stats.get(row.id);
    return {
      ...row,
      totalBids: stat?.total ?? 0,
      highestBid: stat?.highestBid ?? null,
    };
  });
}
