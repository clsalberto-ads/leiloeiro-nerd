"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyPoint } from "@/domain/repositories/analytics-repository";

// ponytail: a serie e uma POR LINHA e a data ja vem pronta do servidor
// (`YYYY-MM-DD` no fuso `America/Sao_Paulo`, preenchida com zero nos dias sem
// movimento — ve o `fill`). O eixo mostra so o dia do mes: `2026-09-29`
// viraria "2026-09-29" inteiro, com 30 marcadores brigando por espaco. Cortar
// aqui, e nao no SQL, mantem a chave completa disponivel no `dataKey` para quem
// precisar do dia exato no tooltip.

const config = {
  bids: { label: "Lances recebidos", color: "var(--color-chart-1)" },
  items: { label: "Itens criados", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

function dayOfMonth(iso: string): string {
  return Number(iso.slice(8, 10)).toString();
}

function toAxisLabel(iso: string): string {
  return `${dayOfMonth(iso)}/${iso.slice(5, 7)}`;
}

export function SellerSeriesChart({
  bidsPerDay,
  itemsCreatedPerDay,
  description,
}: {
  bidsPerDay: DailyPoint[];
  itemsCreatedPerDay: DailyPoint[];
  description: string;
}) {
  // junta as DUAS series por dia: as queries vem separadas (uma por tabela) e
  // o grafico precisa de uma linha por dia, nao de dois arrays paralelos. A
  // `Map` indexa por dia porque o `fill` ja devolveu as duas com o
  // mesmo comprimento e o mesmo conjunto de chaves.
  const perDay = new Map(itemsCreatedPerDay.map((p) => [p.day, p.total]));
  const data = bidsPerDay.map((p) => ({
    day: p.day,
    bids: p.total,
    items: perDay.get(p.day) ?? 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[260px] w-full">
          <AreaChart accessibilityLayer data={data} margin={{ left: 4, right: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              tickMargin={8}
              axisLine={false}
              tickFormatter={toAxisLabel}
              minTickGap={16}
            />
            <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent labelKey="day" />} />
            <Area dataKey="bids" type="monotone" stroke="var(--color-bids)" fill="var(--color-bids)" fillOpacity={0.18} isAnimationActive={false} />
            <Area dataKey="items" type="monotone" stroke="var(--color-items)" fill="var(--color-items)" fillOpacity={0.18} isAnimationActive={false} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
