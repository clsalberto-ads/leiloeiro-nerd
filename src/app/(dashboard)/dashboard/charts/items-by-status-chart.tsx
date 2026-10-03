"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS, type ItemStatus } from "@/domain/repositories/item-repository";

// ponytail: o grafico vai DIRETO para o rotulo do eixo, e a barra e colorida por
// `fill` no dado, nao por `dataKey`. Sao dois jeitos de dizer a mesma coisa no
// Recharts, e o `fill` por linha e o que o `chart` do shadcn usa nos proprios
// exemplos de barra por categoria: o `config` continua sendo a fonte do TOOLTIP,
// e o dado carrega a cor. Fazer o inverso (uma serie por status) produziria uma
// legenda e um tooltip com cinco series para um dado que so tem uma dimensao.

// ponytail: o rotulo NAO e reescrito aqui. `STATUS_LABELS` mora no dominio e e o
// mesmo texto do badge da tabela, da aba e da busca server-side — copiar o mapa
// para este arquivo criaria a segunda fonte de verdade que o
// `item-status-badge.tsx` existe para impedir (veja o `ponytail:` dele). Um
// status novo sem cor aqui e um status novo sem rotulo ali, e ambos aparecem no
// mesmo `tsc`; mas so o `STATUS_LABELS` esta no `Record` exaustivo do dominio.

/** As cores sao os `--chart-N`, e o indice e a POSICAO no array de status. */
const TONES: Record<ItemStatus, string> = {
  draft: "var(--color-chart-1)",
  active: "var(--color-chart-2)",
  closed: "var(--color-chart-3)",
  awaiting_payment: "var(--color-chart-4)",
  paid: "var(--color-chart-5)",
  cancelled: "var(--color-chart-1)",
};

const config = {
  items: { label: "Itens" },
  ...Object.fromEntries(
    (Object.keys(STATUS_LABELS) as ItemStatus[]).map((status) => [status, { label: STATUS_LABELS[status] }]),
  ),
} satisfies ChartConfig;

export function ItemsByStatusChart({ itemsByStatus }: { itemsByStatus: { status: ItemStatus; total: number }[] }) {
  // `name` e `rotulo` sao o MESMO texto, e a duplicata e proposital: `name` e o
  // que o Recharts escreve no `path` da camada acessivel, e sem ele o leitor de
  // tela anuncia "undefined" para cada barra. `rotulo` existe para o eixo e
  // para o `nameKey` do tooltip.
  const data = itemsByStatus.map((row) => ({
    status: row.status,
    items: row.total,
    name: STATUS_LABELS[row.status],
    label: STATUS_LABELS[row.status],
    fill: TONES[row.status],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Itens por situação</CardTitle>
        <CardDescription>Como o seu catálogo está distribuído hoje</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[220px] w-full">
          <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} tickMargin={8} axisLine={false} interval={0} />
            <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
            <Bar dataKey="items" radius={4} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
