"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyPoint } from "@/domain/repositories/analytics-repository";

// ponytail: uma serie so, e por isso BARRA e nao AREA. O grafico do comprador e
// "quantos lances EU dei por dia" — um unico numero por dia. Area preencheria o
// volume embaixo da linha e sugeriria um total acumulado, que nao e o que esta
// medido.

const config = {
  bids: { label: "Meus lances", color: "var(--color-chart-1)" },
} satisfies ChartConfig;

function toAxis(iso: string): string {
  return `${Number(iso.slice(8, 10))}/${iso.slice(5, 7)}`;
}

export function BuyerBidChart({ bidsPerDay }: { bidsPerDay: DailyPoint[] }) {
  const data = bidsPerDay.map((p) => ({ day: p.day, bids: p.total }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meus lances por dia</CardTitle>
        <CardDescription>Quantos lances você deu em cada dia do período</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[240px] w-full">
          <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} tickMargin={8} axisLine={false} tickFormatter={toAxis} minTickGap={16} />
            <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent labelKey="day" />} />
            <Bar dataKey="bids" fill="var(--color-bids)" radius={4} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
