import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Indicator } from "./indicator";
import { BuyerBidChart } from "./bid-chart-buyer";
import type { BuyerView } from "@/application/use-cases/dashboard-summary";
import type { PeriodKey } from "../period/period";
import { periodLabel } from "../period/period";
import { formatBRL } from "@/lib/format-brl";

export function BuyerPanel({ view, period }: { view: BuyerView; period: PeriodKey }) {
  const { summary } = view;
  const windowLabel = periodLabel(period).toLowerCase();

  // a acao vai para a vitrine publica, que e o que um comprador sem lance pode
  // fazer: NAO ha "criar item" aqui — esse e o caminho do vendedor, e a acao
  // precisa levar a pessoa para onde ela realmente tem o que fazer.
  if (summary.totalBids === 0) {
    return (
      <EmptyState
        title="Você ainda não deu nenhum lance"
        description={`Dê um lance em um item de uma vitrine para ver aqui o seu histórico dos últimos ${windowLabel}.`}
        action={{ label: "Explorar vitrines", href: "/" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicator title={`Lances em ${windowLabel}`} value={summary.totalBids} />
        <Indicator title="Itens que você acompanha" value={summary.watchedItems} />
        <Indicator title="Você está liderando" value={summary.leading} />
        <Indicator title="Superados" value={summary.outbid} />
      </div>

      <BuyerBidChart bidsPerDay={summary.bidsPerDay} />

      <Card>
        <CardHeader>
          <CardTitle>Seus lances recentes</CardTitle>
          <CardDescription>Os últimos {summary.recent.length} lances do período</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {summary.recent.map((bid) => (
              <li key={bid.id} className="flex items-center justify-between gap-3">
                <Link
                  href={`/${bid.sellerSlug}/${bid.itemId}`}
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  {bid.itemTitle}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm">R$ {formatBRL(bid.amount)}</span>
                  <Badge variant={bid.isLeading ? "default" : "secondary"}>
                    {bid.isLeading ? "melhor lance" : "superado"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
