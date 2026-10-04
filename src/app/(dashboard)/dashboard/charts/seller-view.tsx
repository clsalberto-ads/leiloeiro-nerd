import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Indicator } from "./indicator";
import { ItemsByStatusChart } from "./items-by-status-chart";
import { SellerSeriesChart } from "./series-chart-seller";
import type { SellerView } from "@/application/use-cases/dashboard-summary";
import type { PeriodKey } from "../period/period";
import { periodLabel } from "../period/period";
import { formatBRL } from "@/lib/format-brl";

export function SellerPanel({ view, period }: { view: SellerView; period: PeriodKey }) {
  const { summary, series } = view;

  // ponytail: tela VAZIA antes dos indicadores, e nao grafico com zero. Um
  // vendedor recem-criado veria quatro "0" e um area chart de 30 dias lisos,
  // que le como "voce nao fez nada" em vez de "voce ainda nao vendeu nada" — as
  // duas coisas parecidas na tela e bem diferentes na vida. O `EmptyState` ja
  // existe e ja tem `action` com `href`, entao nao ha novelty aqui.
  if (summary.totalItems === 0) {
    return (
      <EmptyState
        title="Nenhum item ainda"
        description="Assim que você leiloar algo, os gráficos e indicadores aparecem aqui."
        action={{ label: "Criar primeiro item", href: "/dashboard/items/new" }}
      />
    );
  }

  const bidsInPeriod = series.bidsPerDay.reduce((acc, p) => acc + p.total, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicator title="Itens no total" value={summary.totalItems} />
        <Indicator title="Em leilão" value={summary.activeItems} />
        <Indicator title={`Lances em ${periodLabel(period).toLowerCase()}`} value={bidsInPeriod} />
        <Indicator
          title="Valor listado"
          value={summary.listedValue}
          format="currency"
          change="preço de abertura, não receita"
        />
      </div>

      <SellerSeriesChart
        bidsPerDay={series.bidsPerDay}
        itemsCreatedPerDay={series.itemsCreatedPerDay}
        description={`Lances recebidos e itens criados nos últimos ${periodLabel(period).toLowerCase()}`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ItemsByStatusChart itemsByStatus={summary.itemsByStatus} />

        {/* ponytail: o ranking e uma LISTA, nao um grafico. "Os 5 mais
            disputados" e uma ordenacao por um numero com identificacao — bar,
            pie ou donut so dariam a mesma informacao com pixels a mais, e o
            titulo do item e texto longo, que e o pior formato para um eixo. */}
        <Card>
          <CardHeader>
            <CardTitle>Mais disputados</CardTitle>
            <CardDescription>Os items que mais atraíram lances, em qualquer situação</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.mostContested.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item recebeu lances ainda.</p>
            ) : (
              <ol className="space-y-3">
                {summary.mostContested.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3">
                    <Link
                      href={`/dashboard/items/${item.id}/edit`}
                      className="text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {item.title}
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary">
                        {item.bids} {item.bids === 1 ? "lance" : "lances"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">R$ {formatBRL(item.highestBid ?? 0)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ponytail: `itemsByType` volta do servidor porque e uma quebra real da
          vitrine (um cara que vende so "peça" tem um negocio diferente do que
          vende so "serviço"), mas NAO ganhou grafico proprio: com 3 categorias
          e uma contagem baixa, ele entraria como um donut de fatias de 1 item
          ao lado de dois graficos que ja dizem o essencial. Vira um badge na
          lista quando a categoria existe. Sobe para grafico se a lista passar
          de 5 tipos — e nao antes disso. */}
      {summary.itemsByType.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Por tipo</CardTitle>
            <CardDescription>O mix do seu catálogo</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {summary.itemsByType.map(({ type, total }) => (
              <Badge key={type} variant="outline">
                {type} · {total}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
