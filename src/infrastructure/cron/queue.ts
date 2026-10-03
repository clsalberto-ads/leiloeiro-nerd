import { Queue } from "bullmq";

export const AUCTION_QUEUE = "auction-jobs";

// ponytail: 1 minuto. O prazo de lance e um `timestamptz` e o item so pode ser
// encerrado depois DELE, entao a granularidade aqui e o quanto o grafico de
// "Em leilao" continua mentindo depois do vencimento — um minuto e imperceptivel
// para quem olha a vitrine. Frequencia menor que isso nao compra nada: nenhum
// usuario percebe um item que some 30s depois do prazo, e o UPDATE so trabalha em
// linhas `active` ja vencidas, entao a maioria das execucoes nao escreve nada.
export const CLOSE_EXPIRED_EVERY_MS = 60_000;

export function auctionQueue(): Queue {
  return new Queue(AUCTION_QUEUE, { connection: { url: process.env.REDIS_URL } });
}