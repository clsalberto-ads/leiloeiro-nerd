import { redirect } from "next/navigation";
import { BadgeCheckIcon, CircleDollarSignIcon } from "lucide-react";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzleBidRepository } from "@/infrastructure/database/repositories/drizzle-bid-repository";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { drizzlePaymentRepository } from "@/infrastructure/database/repositories/drizzle-payment-repository";
import { listMyBids } from "@/application/use-cases/list-my-bids";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  // ponytail (R7.3): o estado do PAGAMENTO dos itens arrematados — uma ÚNICA
  // consulta em lote para todos os itens fechados/aguardando, em vez de uma
  // por linha. `pendingByItem` carrega o MAIOR attemptNumber da cascata,
  // que é a cobrança viva.
  const closedItemIds = rows
    .map((r) => r.item?.id)
    .filter((id): id is string => Boolean(id));
  const pendingByItem = await drizzlePaymentRepository.findPendingByItemIds(closedItemIds);

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
              {rows.map((row) => {
                const pending = row.item ? pendingByItem.get(row.item.id) : undefined;
                const isMyPayment = pending?.bidderId === session.user.id;

                return (
                <Card key={row.bid.id}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">{row.item?.title || "Item não encontrado"}</CardTitle>
                    {/* ponytail (R7.3): o badge de pagamento é a diferença entre
                        "eu venci" e "eu venci E preciso pagar" — sem ele o
                        arrematante tinha que PROCURAR a notificação. */}
                    {isMyPayment ? (
                      <Badge className="bg-amber-100 text-amber-800">
                        <CircleDollarSignIcon aria-hidden="true" data-icon="inline-start" />
                        Aguardando pagamento
                      </Badge>
                    ) : row.item?.status === "paid" ? (
                      <Badge className="bg-emerald-100 text-emerald-800">
                        <BadgeCheckIcon aria-hidden="true" data-icon="inline-start" />
                        Pago
                      </Badge>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <span>Valor: {formatBRL(row.bid.amount)}</span>
                      <div className="flex items-center gap-2">
                        {/* ponytail (R7.3): "Pagar" direto — o arrematante que
                            venceu não precisa procurar a notificação para
                            achar o link da cobrança */}
                        {isMyPayment && pending ? (
                          <Button size="sm" nativeButton={false} render={<Link href={`/dashboard/payments/${pending.id}`} />}>
                            <CircleDollarSignIcon data-icon="inline-start" aria-hidden="true" />
                            Pagar
                          </Button>
                        ) : null}
                        {row.item ? (
                          <Button nativeButton={false} render={<Link href={`/${slugById.get(row.item.sellerId) ?? row.item.sellerId}/${row.item.id}`} />} variant="outline" size="sm">Ver item</Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">Indisponível</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
      </PageContainer>
  );
}
