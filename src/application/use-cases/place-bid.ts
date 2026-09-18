import type { BidRepository } from "@/domain/repositories/bid-repository";
import type { ItemRepository } from "@/domain/repositories/item-repository";
import type { NotificationRepository } from "@/domain/repositories/notification-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";

export interface ResendClient {
  emails: {
    send: (args: { from: string; to: string; subject: string; html: string }) => Promise<unknown>;
  };
}

function formatReais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

export async function placeBid(
  itemRepo: ItemRepository,
  bidRepo: BidRepository,
  userRepo: UserRepository,
  notifRepo: NotificationRepository,
  resend: ResendClient,
  bidderId: string,
  itemId: string,
  amount: number,
): Promise<{ bid: Awaited<ReturnType<BidRepository["createBid"]>>; outbidUserId?: string }> {
  const item = await itemRepo.findById(itemId);
  if (!item) throw new Error("Item não encontrado");
  if (item.status !== "active") throw new Error("Item não está em leilão");
  if (item.bidDeadline.getTime() <= Date.now()) throw new Error("Leilão encerrado");
  if (item.sellerId === bidderId) throw new Error("Você não pode dar lance no próprio item");
  const bidder = await userRepo.findById(bidderId);
  if (!bidder || !["bidder", "both"].includes(bidder.role)) throw new Error("Apenas arrematantes podem dar lances");

  const existingBids = await bidRepo.findByItemId(itemId);
  const highestBid = existingBids[0];
  const minBid = highestBid ? highestBid.amount + item.minBidIncrement : item.minInitialBid;
  if (amount < minBid) {
    throw new Error(`Lance deve ser ≥ R$ ${formatReais(minBid)}`);
  }

  const bid = await bidRepo.createBid({ itemId, bidderId, amount });

  let outbidUserId: string | undefined;
  if (highestBid && highestBid.bidderId !== bidderId) {
    outbidUserId = highestBid.bidderId;
    await notifRepo.create({
      userId: outbidUserId,
      type: "outbid",
      title: "Lance superado",
      content: `Seu lance de R$ ${formatReais(highestBid.amount)} em ${item.title} foi superado por R$ ${formatReais(amount)}`,
    });
    try {
      const outbidUser = await userRepo.findById(outbidUserId);
      const seller = await userRepo.findById(item.sellerId);
      if (outbidUser?.email && seller?.slug) {
        await resend.emails.send({
          from: "Leiloeiro Nerd <noreply@leiloeironerd.com>",
          to: outbidUser.email,
          subject: "Seu lance foi superado!",
          html: `<p>Seu lance de R$ ${formatReais(highestBid.amount)} em <strong>${item.title}</strong> foi superado por <strong>R$ ${formatReais(amount)}</strong>.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL}/${seller.slug}/${item.id}">Dar novo lance</a></p>`,
        });
      }
    } catch (e) {
      console.error("[Resend] falha ao enviar outbid:", e);
    }
  }

  return { bid, outbidUserId };
}