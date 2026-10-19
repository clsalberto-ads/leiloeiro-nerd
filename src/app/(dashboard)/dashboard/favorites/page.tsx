import { redirect } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzleFavoriteRepository } from "@/infrastructure/database/repositories/drizzle-favorite-repository";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { listFavoritesByUser } from "@/application/use-cases/list-favorites-by-user";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const favorites = await listFavoritesByUser(drizzleFavoriteRepository, session.user.id);
  // ponytail: os itens e os slugs dos vendedores são buscados em LOTE, não um por
  // favorito (`findByIds`), e o link usa o slug do VENDEDOR do item — não o do
  // usuário logado. Antes o link era `/{usuario logado}/{item}` e apontava para
  // uma vitrine que não existe (404).
  const items = await drizzleItemRepository.findByIds(favorites.map((f) => f.itemId));
  const sellerIds = [...new Set(items.map((i) => i.sellerId))];
  const sellers = await drizzleUserRepository.findByIds(sellerIds);
  const slugById = new Map(sellers.map((s) => [s.id, s.slug]));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <PageHeader title="Favoritos" description="Itens que você marcou como favoritos" />
          {items.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">Nenhum favorito ainda</p>
                <Button className="mt-4" nativeButton={false} render={<Link href="/dashboard">Voltar ao dashboard</Link>} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/${slugById.get(item.sellerId) ?? item.sellerId}/${item.id}`}>Ver item</Link>} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
