import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Indicador } from "./indicador";
import { GrafoLancesDoComprador } from "./grafo-lances-comprador";
import type { VisaoDoComprador } from "@/application/use-cases/resumo-do-dashboard";
import type { ChavePeriodo } from "../periodo/periodo";
import { nomeDoPeriodo } from "../periodo/periodo";
import { formatReais } from "@/lib/format-reais";

export function VisaoDoCompradorPainel({ visao, periodo }: { visao: VisaoDoComprador; periodo: ChavePeriodo }) {
  const { resumo } = visao;
  const janela = nomeDoPeriodo(periodo).toLowerCase();

  // a acao vai para a vitrine publica, que e o que um comprador sem lance pode
  // fazer: NAO ha "criar item" aqui — esse e o caminho do seller, e a acao
  // precisa levar a pessoa para onde ela realmente tem o que fazer.
  if (resumo.totalLances === 0) {
    return (
      <EmptyState
        title="Você ainda não deu nenhum lance"
        description={`Dê um lance em um item de uma vitrine para ver aqui o seu histórico dos últimos ${janela}.`}
        action={{ label: "Explorar vitrines", href: "/" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo={`Lances em ${janela}`} valor={resumo.totalLances} />
        <Indicador titulo="Itens que você acompanha" valor={resumo.itensAcompanhados} />
        <Indicador titulo="Você está liderando" valor={resumo.liderando} />
        <Indicador titulo="Superados" valor={resumo.superado} />
      </div>

      <GrafoLancesDoComprador lancesPorDia={resumo.lancesPorDia} />

      <Card>
        <CardHeader>
          <CardTitle>Seus lances recentes</CardTitle>
          <CardDescription>Os últimos {resumo.recentes.length} lances do período</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {resumo.recentes.map((lance) => (
              <li key={lance.id} className="flex items-center justify-between gap-3">
                <Link
                  href={`/${lance.vendedorSlug}/${lance.itemId}`}
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  {lance.itemTitle}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm">R$ {formatReais(lance.amount)}</span>
                  <Badge variant={lance.liderando ? "default" : "secondary"}>
                    {lance.liderando ? "melhor lance" : "superado"}
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
