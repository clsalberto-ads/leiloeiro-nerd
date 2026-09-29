import type { Bid } from "@/domain/repositories/bid-repository";
import { formatReais } from "@/lib/format-reais";

export function BidHistory({ bids }: { bids: Bid[] }) {
  if (bids.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum lance ainda.</p>;
  }

  // ponytail: a coluna se chama "Lance nº" e NAO "Posição". `bid.rank` e um
  // contador de sequencia (`nextRank` = maior rank anterior + 1), nao a colocacao
  // competitiva: com lances de R$ 50, R$ 70 e R$ 100, os ranks saem 1, 2 e 3
  // enquanto a tabela e ordenada por `amount DESC` — o vencedor aparecia como
  // "Posicao 3" e o perdedor mais baixo como "Posicao 1", lido de tras para
  // frente. A posicao real e a ordem da propria tabela, entao rotular a coluna
  // com o dado que ela tem e o arranjo de uma linha, sem tocar no repositorio
  // nem no que os testes de `nextRank` fixam.
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-2 pr-4 font-medium">Lance nº</th>
          <th className="py-2 pr-4 font-medium">Valor</th>
          <th className="py-2 pr-4 font-medium">Arrematante</th>
          <th className="py-2 font-medium">Data</th>
        </tr>
      </thead>
      <tbody>
        {bids.map((bid) => (
          <tr key={bid.id} className="border-b">
            <td className="py-2 pr-4">{bid.rank ?? "–"}</td>
            <td className="py-2 pr-4">R$ {formatReais(bid.amount)}</td>
            <td className="py-2 pr-4">{bid.bidderName}</td>
            <td className="py-2">{new Date(bid.createdAt).toLocaleDateString("pt-BR")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}