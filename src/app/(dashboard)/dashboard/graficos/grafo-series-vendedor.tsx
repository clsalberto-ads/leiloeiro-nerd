"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PontoPorDia } from "@/domain/repositories/analise-repository";

// ponytail: a serie e uma POR LINHA e a data ja vem pronta do servidor
// (`YYYY-MM-DD` no fuso `America/Sao_Paulo`, preenchida com zero nos dias sem
// movimento — ve o `preencherDias`). O eixo mostra so o dia do mes: `2026-09-29`
// viraria "2026-09-29" inteiro, com 30 marcadores brigando por espaco. Cortar
// aqui, e nao no SQL, mantem a chave completa disponivel no `dataKey` para quem
// precisar do dia exato no tooltip.

const config = {
  lances: { label: "Lances recebidos", color: "var(--color-chart-1)" },
  itens: { label: "Itens criados", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

function diaDoMes(iso: string): string {
  return Number(iso.slice(8, 10)).toString();
}

function paraEixo(iso: string): string {
  return `${diaDoMes(iso)}/${iso.slice(5, 7)}`;
}

export function GrafoSeriesDoVendedor({
  lancesPorDia,
  itensCriadosPorDia,
  descricao,
}: {
  lancesPorDia: PontoPorDia[];
  itensCriadosPorDia: PontoPorDia[];
  descricao: string;
}) {
  // junta as DUAS series por dia: as queries vem separadas (uma por tabela) e
  // o grafico precisa de uma linha por dia, nao de dois arrays paralelos. A
  // `Map` indexa por dia porque o `preencherDias` ja devolveu as duas com o
  // mesmo comprimento e o mesmo conjunto de chaves.
  const porDia = new Map(itensCriadosPorDia.map((p) => [p.dia, p.total]));
  const dados = lancesPorDia.map((p) => ({
    dia: p.dia,
    lances: p.total,
    itens: porDia.get(p.dia) ?? 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[260px] w-full">
          <AreaChart accessibilityLayer data={dados} margin={{ left: 4, right: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="dia"
              tickLine={false}
              tickMargin={8}
              axisLine={false}
              tickFormatter={paraEixo}
              minTickGap={16}
            />
            <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent labelKey="dia" />} />
            <Area dataKey="lances" type="monotone" stroke="var(--color-lances)" fill="var(--color-lances)" fillOpacity={0.18} isAnimationActive={false} />
            <Area dataKey="itens" type="monotone" stroke="var(--color-itens)" fill="var(--color-itens)" fillOpacity={0.18} isAnimationActive={false} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
