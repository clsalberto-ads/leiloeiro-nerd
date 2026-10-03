import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/format-brl";

// ponytail: um `Indicator` generico e NAO cinco cards escritos a mao. Os cinco
// tem a mesma forma (rotulo, valor, variacao opcional) e a diferenca entre eles
// e so o conteudo; cinco divs repetidos seriam o mesmo componente com o nome
// trocado. `formato` existe porque o valor nao e sempre um numero de lances —
// dinheiro entra pelo `formatBRL` (centavos) e contagem entra crua, e formatar
// "3.00,00" lances seria o bug.

type IndicatorFormat = "count" | "currency";

export function Indicator({
  title,
  value,
  format = "count",
  change,
}: {
  title: string;
  value: number;
  format?: IndicatorFormat;
  change?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{format === "currency" ? formatBRL(value) : value}</p>
        {change ? <p className="text-xs text-muted-foreground">{change}</p> : null}
      </CardContent>
    </Card>
  );
}
