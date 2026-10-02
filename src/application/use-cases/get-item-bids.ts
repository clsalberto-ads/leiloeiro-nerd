import type { Bid, BidRepository } from "@/domain/repositories/bid-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";

// ponytail: UMA consulta para todos os arrematantes, e nao uma por lance. O
// `findById` em `Promise.all` parecia concorrente, mas continua sendo N idas ao
// banco: o polling publico da vitrine roda a cada 10s, e um item com 300 lances
// virava 301 queries por ciclo contra o pool de 10 conexoes do `pg` — com a aba
// de um visitante anonimo ableando o dashboard de outro. O `[...new Set]` e o
// que evita repetir a MESMA pessoa quando ela deu varios lances. Lance cujo
// `bidderId` nao volta na consulta (usuario apagado) fica com o `bidderId` que o
// repositorio de lances ja tinha posto no lugar do nome — comportamento de
// antes, mantido de proposito.
export async function resolveBidderNames(bids: Bid[], userRepo: UserRepository): Promise<Bid[]> {
  if (bids.length === 0) return bids;
  const ids = [...new Set(bids.map((b) => b.bidderId))];
  const users = await userRepo.findByIds(ids);
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  return bids.map((bid) => {
    const name = nameById.get(bid.bidderId);
    return name ? { ...bid, bidderName: name } : bid;
  });
}

export async function getItemBids(
  bidRepo: BidRepository,
  userRepo: UserRepository,
  itemId: string,
): Promise<Bid[]> {
  const bids = await bidRepo.findByItemId(itemId);
  return resolveBidderNames(bids, userRepo);
}
