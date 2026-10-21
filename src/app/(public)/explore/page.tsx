import { SearchIcon } from "lucide-react";
import { PublicItemCard } from "@/components/public-item-card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listExploreItems } from "@/application/use-cases/list-explore-items";
import { drizzleExploreLister } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleBidStatsList } from "@/infrastructure/database/repositories/drizzle-bid-repository";
import { firstValue } from "@/lib/first-value";

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

// ponytail (R7.2): a busca é um `<form method="get">` — o mesmo desenho da
// vitrine. O navegador escreve a URL, o servidor filtra. `type !== undefined`
// preserva o estado da busca entre renders (o Input é defaultValue, não
// controlled, para não exigir client-side state).
function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matchesSearch(
  item: { title: string; type: string },
  q: string,
): boolean {
  const needle = stripDiacritics(q);
  return (
    stripDiacritics(item.title).includes(needle) ||
    stripDiacritics(item.type).includes(needle)
  );
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (firstValue(sp.q) ?? "").trim();

  const items = await listExploreItems(drizzleExploreLister, drizzleBidStatsList);

  // ponytail (R7.2): com busca, a página vira uma GRADE ÚNICA filtrada —
  // seções separadas com 3 resultados repetidos em cada uma são ruído para
  // quem procura algo específico.
  if (q !== "") {
    const results = items.filter((item) => matchesSearch(item, q));
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader title="Descobrir" description="Leilões ativos" />
        <form method="get" action="/explore" className="flex items-center gap-2">
          <label htmlFor="explore-search" className="sr-only">Buscar leilão</label>
          <Input
            id="explore-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Buscar item..."
            className="max-w-xs"
          />
          <Button type="submit" variant="outline" size="sm">
            <SearchIcon data-icon="inline-start" aria-hidden="true" />
            Buscar
          </Button>
        </form>
        {results.length === 0 ? (
          <EmptyState
            title="Nenhum leilão encontrado"
            description={`Nada casou com "${q}". Tente outro termo.`}
            icon={<SearchIcon aria-hidden="true" className="size-6 text-muted-foreground" />}
            action={{ label: "Limpar busca", href: "/explore" }}
          />
        ) : (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              {results.length} resultado{results.length === 1 ? "" : "s"} para &#34;{q}&#34;
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {results.map((item) => (
                <PublicItemCard key={item.id} item={item} slug={item.sellerSlug ?? ""} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

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
      {/* ponytail (R7.2): a busca aqui — mesma posição da vitrine, para o
          usuário achar SEM olhar */}
      <form method="get" action="/explore" className="flex items-center gap-2">
        <label htmlFor="explore-search" className="sr-only">Buscar leilão</label>
        <Input
          id="explore-search"
          name="q"
          type="search"
          placeholder="Buscar item..."
          className="max-w-xs"
        />
        <Button type="submit" variant="outline" size="sm">
          <SearchIcon data-icon="inline-start" aria-hidden="true" />
          Buscar
        </Button>
      </form>

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
