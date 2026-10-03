import { redirect } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzleFavoriteRepository } from "@/infrastructure/database/repositories/drizzle-favorite-repository";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { listFavoritesByUser } from "@/application/use-cases/list-favorites-by-user";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function FavoritesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const favorites = await listFavoritesByUser(drizzleFavoriteRepository, session.user.id);
  const items = await Promise.all(
    favorites.map(async (f) => {
      const item = await drizzleItemRepository.findById(f.itemId);
      return item;
    }),
  );

  const validItems = items.filter((i): i is NonNullable<typeof i> => Boolean(i));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardHeader userName={session.user.name} />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <PageHeader title="Favoritos" description="Itens que você marcou como favoritos" />
          {validItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">Nenhum favorito ainda</p>
                <Button className="mt-4" render={<Link href="/dashboard">Voltar ao dashboard</Link>} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {validItems.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" variant="outline" render={<Link href={`/${session.user.slug || session.user.id}/${item.id}`}>Ver item</Link>} />
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
