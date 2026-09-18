import type { Bid } from "@/domain/repositories/bid-repository";

export function BidHistory({ bids }: { bids: Bid[] }) {
  if (bids.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum lance ainda.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-2 pr-4 font-medium">Posição</th>
          <th className="py-2 pr-4 font-medium">Valor</th>
          <th className="py-2 pr-4 font-medium">Arrematante</th>
          <th className="py-2 font-medium">Data</th>
        </tr>
      </thead>
      <tbody>
        {bids.map((bid) => (
          <tr key={bid.id} className="border-b">
            <td className="py-2 pr-4">{bid.rank ?? "–"}</td>
            <td className="py-2 pr-4">R$ {(bid.amount / 100).toFixed(2)}</td>
            <td className="py-2 pr-4">{bid.bidderName}</td>
            <td className="py-2">{new Date(bid.createdAt).toLocaleDateString("pt-BR")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}