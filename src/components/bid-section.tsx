"use client";
import { startTransition, useEffect, useState } from "react";
import { getItemBidsAction } from "@/presentation/actions/bid-actions";
import { BidForm } from "@/components/bid-form";
import { BidHistory } from "@/components/bid-history";
import type { Bid } from "@/domain/repositories/bid-repository";

interface BidSectionProps {
  itemId: string;
  initialBids: Bid[];
  minInitialBid: number;
  minBidIncrement: number;
  /** Prazo de lances do item. Ausente = item sem prazo (nao desliga o form). */
  deadline?: Date | string;
}

export function BidSection({ itemId, initialBids, minInitialBid, minBidIncrement, deadline }: BidSectionProps) {
  const [bids, setBids] = useState<Bid[]>(initialBids);
  // ponytail: o `deadline` desce do servidor porque o `status` sozinho nao diz
  // que o leilao esta aberto — nada transiciona `active -> closed`, entao um item
  // com prazo vencido continua `active` para sempre. Sem isto o `BidCountdown`
  // acima dizia "Encerrado" e o formulario logo abaixo aceitava o lance, que o
  // servidor so recusava DEPOIS de digitado ("Leilao encerrado").
  //
  // `Date.now()` fica no INICIALIZADOR do `useState`, e nao no corpo do
  // componente: o lint `react-hooks/purity` do React Compiler marca leitura de
  // relogio durante o render como impure, porque dois renders do mesmo estado
  // poderiam dar valores diferentes. E a mesma forma que o `bid-countdown.tsx:22`
  // ja usava. Nao ha efeito sincronizando este estado com `deadline` porque o
  // prop NAO muda com a pagina montada (ele vem de um server component
  // `force-dynamic`, e o componente remonta a cada item): um `setState` direto
  // num efeito aqui so custaria o lint de render em cascata. O prazo que vence
  // COM a pagina aberta e pego no poll abaixo.
  const [encerrado, setEncerrado] = useState(
    () => Boolean(deadline) && new Date(deadline!).getTime() <= Date.now(),
  );

  useEffect(() => {
    // ponytail: o poll para quando o leilao encerra, e `setInterval` nao
    // espelha a tab: o `document.hidden` evita que uma aba de fundo acorde a
    // cada 10s e mantenha lances subindo para ninguem. O `.catch` tambem nao e
    // decorativo — sem ele, uma rejeicao do fetch do server action viraria
    // "unhandled rejection" no console a cada ciclo.
    if (encerrado) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      // reavalia o prazo a cada ciclo: e o que desliga o formulario se o
      // leilao vencer com a pagina aberta (e nao so no primeiro render).
      if (deadline && new Date(deadline).getTime() <= Date.now()) {
        setEncerrado(true);
        return;
      }
      const formData = new FormData();
      formData.set("itemId", itemId);
      startTransition(() => {
        void getItemBidsAction(null, formData)
          .then((res) => {
            if (res.bids) setBids(res.bids);
          })
          .catch(() => {});
      });
    }, 10_000);
    return () => clearInterval(id);
  }, [itemId, encerrado, deadline]);

  const minBid = bids.length > 0 ? bids[0].amount + minBidIncrement : minInitialBid;

  // ponytail: o lance que acabou de sair entra na lista na hora, sem esperar o
  // poll. O `form.reset` do `BidForm` tambem dispara a remontagem por causa do
  // `key={minBid}`, entao o `min` do input ja sobe para o novo piso no mesmo
  // render — o que mantem o lance seguinte valido, em vez de o cliente recusar
  // por ate 10s com o piso velho.
  const registrarLance = (bid: Bid) => {
    setBids((atuais) => [bid, ...atuais.filter((b) => b.id !== bid.id)]);
  };

  return (
    <div className="space-y-4">
      {encerrado ? (
        <p className="text-sm text-muted-foreground">Leilão encerrado — não aceita mais lances.</p>
      ) : (
        <BidForm key={minBid} itemId={itemId} minBid={minBid} onBid={registrarLance} />
      )}
      <BidHistory bids={bids} />
    </div>
  );
}
