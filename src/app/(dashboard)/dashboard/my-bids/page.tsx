import { redirect } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzleBidRepository } from "@/infrastructure/database/repositories/drizzle-bid-repository";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { listMyBids } from "@/application/use-cases/list-my-bids";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/format-brl";

export default async function MyBidsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rows = await listMyBids(drizzleBidRepository, drizzleItemRepository, session.user.id, 100);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardHeader userName={session.user.name} />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <PageHeader title="Meus lances" description="Histórico dos seus lances" />
          {rows.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">Nenhum lance ainda</p>
                <Link href="/dashboard" className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 mt-4">Voltar ao dashboard</Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <Card key={row.bid.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{row.item?.title || "Item não encontrado"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <span>Valor: {formatBRL(row.bid.amount)}</span>
                      {row.item ? (
                        <Link href={`/${row.item.sellerId}/${row.item.id}`} className="inline-flex h-7 items-center justify-center rounded-lg border px-2.5 text-sm hover:bg-muted">Ver item</Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">Indisponível</span>
                      )}
                    </div>
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
