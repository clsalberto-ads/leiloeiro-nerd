import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatReais } from "@/lib/format-reais";

// ponytail: um `Indicador` generico e NAO cinco cards escritos a mao. Os cinco
// tem a mesma forma (rotulo, valor, variacao opcional) e a diferenca entre eles
// e so o conteudo; cinco divs repetidos seriam o mesmo componente com o nome
// trocado. `formato` existe porque o valor nao e sempre um numero de lances —
// dinheiro entra pelo `formatReais` (centavos) e contagem entra crua, e formatar
// "3.00,00" lances seria o bug.

type Formato = "contagem" | "reais";

export function Indicador({
  titulo,
  valor,
  formato = "contagem",
  variacao,
}: {
  titulo: string;
  valor: number;
  formato?: Formato;
  variacao?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{formato === "reais" ? formatReais(valor) : valor}</p>
        {variacao ? <p className="text-xs text-muted-foreground">{variacao}</p> : null}
      </CardContent>
    </Card>
  );
}
