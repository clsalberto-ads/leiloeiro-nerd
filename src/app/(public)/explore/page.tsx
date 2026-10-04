import { PublicItemCard } from "@/components/public-item-card";
import { PageHeader } from "@/components/layout/page-header";
import { AppHeader } from "@/components/layout/app-header";
import type { StorefrontItem } from "@/domain/repositories/item-repository";

export default async function ExplorePage() {
  const ending: StorefrontItem[] = [];
  const recent: StorefrontItem[] = [];
  const popular: StorefrontItem[] = [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <PageHeader title="Descobrir" description="Leilões ativos" />
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Terminando em breve</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ending.map((item) => (
                <PublicItemCard key={item.id} item={item} slug={(item as any).sellerId ?? (item as any).seller?.slug ?? ""} />
              ))}
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Mais recentes</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recent.map((item) => (
                <PublicItemCard key={item.id} item={item} slug={(item as any).sellerId ?? (item as any).seller?.slug ?? ""} />
              ))}
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Destaques</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {popular.map((item) => (
                <PublicItemCard key={item.id} item={item} slug={(item as any).sellerId ?? (item as any).seller?.slug ?? ""} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
