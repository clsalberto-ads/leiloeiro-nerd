import type { Item, ItemStatus } from "@/domain/repositories/item-repository";

// ponytail: esta e a fronteira de serializacao da tela. O `Item` completo tem 13
// campos — 7 deles sao de-edicao (`updatedAt`, `sellerId`, `minBidIncrement`,
// `paymentDeadlineDays`) ou inuteis para a tabela (`description`, `imageUrl`) — e
// nenhum desses precisa atravessar a barreira RSC para virar HTML.
//
// E "atravessar a barreira" e a palavra: este objeto e passado do servidor para
// o componente cliente (`"use client"`), o que significa que o React o serializa
// no payload da navegacao. `description` pode ser um texto longo e `imageUrl` uma
// string de CDN; nenhum dos dois aparece na tabela. O custo de mandar os 13 e
// o de manter um campo a mais que a tela nao usa (e que alguem, no mes, usaria
// por engano).
export interface DashboardItemRow {
  id: string;
  title: string;
  type: Item["type"];
  minInitialBid: Item["minInitialBid"];
  bidDeadline: Item["bidDeadline"];
  status: ItemStatus;
}

// ponytail: e uma whitelist, e nao um "escolha o que quer". Copiar campo a campo
// e o que faz `description` sumir; `const { ...resto } = item` e o que faz um
// campo novo do dominio vazar para a tela sem ninguem perceber — o `teste` que
// exige exatamente estas seis chaves e o que trava essa porta, porque o proximo
// `Item` novo quebra o teste em vez de aumentar a tabela.
export function toDashboardItemRow(item: Item): DashboardItemRow {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    minInitialBid: item.minInitialBid,
    bidDeadline: item.bidDeadline,
    status: item.status,
  };
}
