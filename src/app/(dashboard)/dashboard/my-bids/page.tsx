import { redirect } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzleBidRepository } from "@/infrastructure/database/repositories/drizzle-bid-repository";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { listMyBids } from "@/application/use-cases/list-my-bids";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/format-brl";

export const dynamic = "force-dynamic";

export default async function MyBidsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rows = await listMyBids(drizzleBidRepository, drizzleItemRepository, session.user.id, 100);

  // ponytail: o link "Ver item" precisa do slug do VENDEDOR do item, não do
  // `sellerId` (UUID) — a rota é `/[slug]/[itemId]`. Os slugs são resolvidos em
  // uma única consulta em lote.
  const sellerIds = [...new Set(rows.map((r) => r.item?.sellerId).filter((id): id is string => Boolean(id)))];
  const sellers = await drizzleUserRepository.findByIds(sellerIds);
  const slugById = new Map(sellers.map((s) => [s.id, s.slug]));

  return (
    <PageContainer size="wide">
<PageHeader title="Meus lances" description="Histórico dos seus lances" />
          {rows.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">Nenhum lance ainda</p>
                <Button nativeButton={false} render={<Link href="/dashboard" />} className="mt-4">Voltar ao dashboard</Button>
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
                        <Button nativeButton={false} render={<Link href={`/${slugById.get(row.item.sellerId) ?? row.item.sellerId}/${row.item.id}`} />} variant="outline" size="sm">Ver item</Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">Indisponível</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
      </PageContainer>
  );
}
