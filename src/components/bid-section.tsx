"use client";
import { startTransition, useCallback, useEffect, useState } from "react";
import { getItemBidsAction } from "@/presentation/actions/bid-actions";
import { BidForm } from "@/components/bid-form";
import { BidHistory } from "@/components/bid-history";
import type { BidView } from "@/domain/repositories/bid-repository";

interface BidSectionProps {
  itemId: string;
  initialBids: BidView[];
  minInitialBid: number;
  minBidIncrement: number;
  /** Prazo de lances do item. Ausente = item sem prazo (nao desliga o form). */
  deadline?: Date | string;
}

export function BidSection({ itemId, initialBids, minInitialBid, minBidIncrement, deadline }: BidSectionProps) {
  const [bids, setBids] = useState<BidView[]>(initialBids);
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
  // poll.
  //
  // O `key={minBid}` que existia aqui nao era necessario e custava o campo de
  // digitado: o `minBid` sobe toda vez que CHEGAM lances de outra pessoa — o poll
  // de 10s traz `setBids` com array novo, o piso sobe, a `key` muda e o React
  // DESPARTA o `BidForm` inteiro. Quem estava digitando o valor perdia o que tinha
  // digitado, sem aviso, no instante em que alguem mais deu lance. Piso e schema
  // nao precisam de remontagem para acompanhar o prop: o `min` do input, o
  // `zodResolver(bidFormSchema(minBid))` e o `amountReais` do reset ja leem
  // `minBid` a cada render. E o `placeBid` e memoizado porque o `onBid` esta no
  // array de deps do efeito do `BidForm`.
  const placeBid = useCallback((bid: BidView) => {
    setBids((atuais) => [bid, ...atuais.filter((b) => b.id !== bid.id)]);
  }, []);

  return (
    <div className="space-y-4">
      {encerrado ? (
        <p className="text-sm text-muted-foreground">Leilão encerrado — não aceita mais lances.</p>
      ) : (
        <BidForm itemId={itemId} minBid={minBid} onBid={placeBid} />
      )}
      <BidHistory bids={bids} />
    </div>
  );
}
