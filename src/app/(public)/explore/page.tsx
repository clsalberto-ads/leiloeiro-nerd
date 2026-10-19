import { PublicItemCard } from "@/components/public-item-card";
import { PageHeader } from "@/components/layout/page-header";
import { listExploreItems } from "@/application/use-cases/list-explore-items";
import { drizzleExploreLister } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleBidStatsList } from "@/infrastructure/database/repositories/drizzle-bid-repository";

export const dynamic = "force-dynamic";

// ponytail: a página é um server component e busca tudo uma vez só, no servidor.
// As três seções são o MESMO conjunto de itens ativos ordenado por três chaves
// diferentes — "terminando em breve" (prazo), "mais recentes" (criação) e
// "destaques" (nº de lances). Cada seção fica com no máximo 8 cards para a grade
// não virar uma página infinita.
//
// O `AppHeader` NÃO é renderizado aqui: o `(public)/layout.tsx` já o fornece
// (assim como o `<main>`), e renderizar de novo duplicaria o cabeçalho.
const SECTION_LIMIT = 8;

export default async function ExplorePage() {
  const items = await listExploreItems(drizzleExploreLister, drizzleBidStatsList);

  const byDeadline = [...items].sort(
    (a, b) => a.bidDeadline.getTime() - b.bidDeadline.getTime(),
  );
  const byRecency = [...items].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const byPopularity = [...items].sort((a, b) => b.totalBids - a.totalBids);

  const ending = byDeadline.slice(0, SECTION_LIMIT);
  const recent = byRecency.slice(0, SECTION_LIMIT);
  const popular = byPopularity
    .filter((item) => item.totalBids > 0)
    .slice(0, SECTION_LIMIT);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Descobrir" description="Leilões ativos" />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Terminando em breve</h2>
        {ending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum leilão ativo agora.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ending.map((item) => (
              <PublicItemCard key={item.id} item={item} slug={item.sellerSlug ?? ""} />
            ))}
          </div>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Mais recentes</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum leilão ativo agora.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((item) => (
              <PublicItemCard key={item.id} item={item} slug={item.sellerSlug ?? ""} />
            ))}
          </div>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Destaques</h2>
        {popular.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item recebeu lances ainda.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {popular.map((item) => (
              <PublicItemCard key={item.id} item={item} slug={item.sellerSlug ?? ""} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
