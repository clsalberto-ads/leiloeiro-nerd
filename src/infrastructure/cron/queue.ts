import { Queue } from "bullmq";

export const AUCTION_QUEUE = "auction-jobs";

// ponytail: 1 minuto. O prazo de lance e um `timestamptz` e o item so pode ser
// encerrado depois DELE, entao a granularidade aqui e o quanto o grafico de
// "Em leilao" continua mentindo depois do vencimento — um minuto e imperceptivel
// para quem olha a vitrine. Frequencia menor que isso nao compra nada: nenhum
// usuario percebe um item que some 30s depois do prazo, e o UPDATE so trabalha em
// linhas `active` ja vencidas, entao a maioria das execucoes nao escreve nada.
export const CLOSE_EXPIRED_EVERY_MS = 60_000;

// ponytail: 10 minutos. E o UNICO gatilho da cascata (spec §3.3) e o vencimento
// de cobranca nao e urgente como o encerramento do leilao: o prazo do
// pagamento se conta em DIAS, e o arrematante nao perde nada por ate 10 min
// de atraso no vencimento. E o mesmo UPDATE condicional de `markExpired`.
export const VERIFICAR_PRAZOS_EVERY_MS = 10 * 60_000;

// ponytail: 15 minutos. Rede de segurança do webhook: reconcilia pendentes
// antigos com a MP. Se o webhook funciona, este job nao faz NADA — e por isso
// que pode ser raro; se o webhook nao chega, 15 min de atraso sao o preco de
// descobrir um pagamento aprovado sem notificacao.
export const SINCRONIZAR_MP_EVERY_MS = 15 * 60_000;

export function auctionQueue(): Queue {
  return new Queue(AUCTION_QUEUE, { connection: { url: process.env.REDIS_URL } });
}