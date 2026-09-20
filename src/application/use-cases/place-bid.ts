import type { Bid, BidRepository } from "@/domain/repositories/bid-repository";
import type { ItemRepository } from "@/domain/repositories/item-repository";
import type { NotificationRepository } from "@/domain/repositories/notification-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import { renderOutbidEmail } from "@/lib/email-templates";
import { formatReais } from "@/lib/format-reais";

export interface ResendClient {
  emails: {
    send: (args: { from: string; to: string; subject: string; html: string }) => Promise<unknown>;
  };
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
): Promise<{ bid: Bid; outbidUserId?: string }> {
  const item = await itemRepo.findById(itemId);
  if (!item) throw new Error("Item não encontrado");
  if (item.status !== "active") throw new Error("Item não está em leilão");
  if (item.bidDeadline.getTime() <= Date.now()) throw new Error("Leilão encerrado");
  if (item.sellerId === bidderId) throw new Error("Você não pode dar lance no próprio item");
  const bidder = await userRepo.findById(bidderId);
  if (!bidder || !["bidder", "both"].includes(bidder.role)) throw new Error("Apenas arrematantes podem dar lances");

  const { bid, previousHighestBid } = await bidRepo.placeBid({ itemId, bidderId, amount }, (ctx) => {
    if (!ctx.item) throw new Error("Item não encontrado");
    if (ctx.item.status !== "active") throw new Error("Item não está em leilão");
    if (ctx.item.bidDeadline.getTime() <= Date.now()) throw new Error("Leilão encerrado");
    if (ctx.item.sellerId === bidderId) throw new Error("Você não pode dar lance no próprio item");
    const minBid = ctx.highestBid ? ctx.highestBid.amount + ctx.item.minBidIncrement : ctx.item.minInitialBid;
    if (amount < minBid) {
      throw new Error(`Lance deve ser ≥ R$ ${formatReais(minBid)}`);
    }
  });

  let outbidUserId: string | undefined;
  if (previousHighestBid && previousHighestBid.bidderId !== bidderId) {
    outbidUserId = previousHighestBid.bidderId;
    try {
      await notifRepo.create({
        userId: outbidUserId,
        type: "outbid",
        title: "Lance superado",
        content: `Seu lance de R$ ${formatReais(previousHighestBid.amount)} em ${item.title} foi superado por R$ ${formatReais(amount)}`,
      });
      const outbidUser = await userRepo.findById(outbidUserId);
      const seller = await userRepo.findById(item.sellerId);
      if (outbidUser?.email && seller?.slug) {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "Leiloeiro Nerd <noreply@leiloeironerd.com>",
          to: outbidUser.email,
          subject: "Seu lance foi superado!",
          html: renderOutbidEmail({
            bidderName: outbidUser.name,
            itemTitle: item.title,
            oldAmount: previousHighestBid.amount,
            newAmount: amount,
            itemUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${seller.slug}/${item.id}`,
          }),
        });
      }
    } catch (e) {
      console.error("[Resend] falha ao enviar outbid:", e);
    }
  }

  return { bid, outbidUserId };
}