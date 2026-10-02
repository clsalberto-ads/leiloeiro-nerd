import type { Bid, BidRepository } from "@/domain/repositories/bid-repository";
import type { ItemRepository } from "@/domain/repositories/item-repository";
import type { NotificationRepository } from "@/domain/repositories/notification-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import { renderOutbidEmail } from "@/lib/email-templates";
import { formatBRL } from "@/lib/format-brl";
import { invalidMoney } from "./money-guards";

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
  // ponytail: `amount` nunca era validado aqui. Todo o resto do lance e
  // re-checado dentro da transacao justamente para nao confiar no schema — e o
  // `placeBidSchema` da action cobre o caminho HTTP, mas o use case nao e o
  // unico chamador: um `NaN` de outra origem passava pelos
  // quatro portoes e ia para a coluna `bids.amount`. O guard fica ANTES de qualquer
  // consulta porque nao ha item carregado para compare aqui: um valor nao-finito nao
  // e "lance abaixo do minimo", e um erro proprio que nao mente sobre o piso.
  if (invalidMoney(amount)) throw new Error("Lance inválido");
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
    // ponytail: o piso vem do ITEM, entao um `minBidIncrement` fracionario ou
    // `NaN` gravado antes derruba o lance tambem. Sem esta checagem, o
    // `formatBRL` da mensagem de erro imprimia um valor que o `invalidMoney`
    // jamais aceitaria, e a comparacao `amount < minBid` ficava comparando
    // float com float num dominio que e centavo inteiro.
    if (invalidMoney(minBid)) throw new Error("Lance inválido");
    if (amount < minBid) {
      throw new Error(`Lance deve ser ≥ R$ ${formatBRL(minBid)}`);
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
        content: `Seu lance de R$ ${formatBRL(previousHighestBid.amount)} em ${item.title} foi superado por R$ ${formatBRL(amount)}`,
      });
    } catch (e) {
      // ponytail: a notificacao no banco e o que a UI le; o e-mail e o extra.
      // Falhar num dos dois nao pode desfazer o lance (que ja foi commitado),
      // entao os dois erros sao registrados e engolidos de proposito — mas o LOG
      // dizia "[Resend]" para os dois, mandando quem fosse de plantao procurar
      // no provedor de e-mail uma falha que era do INSERT em `notifications`.
      console.error("[bid] falha ao gravar notificacao de lance superado:", e);
    }
    const outbidUser = await userRepo.findById(outbidUserId);
    const seller = await userRepo.findById(item.sellerId);
    if (outbidUser?.email && seller?.slug) {
      // ponytail: o `?? "http://localhost:3000"` e o mesmo razao do
      // `RESEND_FROM_EMAIL ??` acima: sem o, um deploy que esqueceu a variavel
      // mandava um link `undefined/maria-seller/item1` — um CTA morto, no
      // e-mail que existe so para trazer o arrematante de volta. O
      // `place-bid.test.ts` nao pegaria: ele casa por `stringContaining`, e
      // `undefined/maria-seller/item1` tambem contem `/maria-seller/item1`.
      const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      try {
        const sendResult = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "Leiloeiro Nerd <noreply@leiloeironerd.com>",
          to: outbidUser.email,
          subject: "Seu lance foi superado!",
          html: renderOutbidEmail({
            bidderName: outbidUser.name,
            itemTitle: item.title,
            oldAmount: previousHighestBid.amount,
            newAmount: amount,
            itemUrl: `${base}/${seller.slug}/${item.id}`,
          }),
        });
        // ponytail: o `send` do Resend NAO lanca em erro de API — ele RETORNA
        // `{ data: null, error }` para qualquer status nao-2xx, e so lanca em
        // falha de rede. O `try/catch` sozinho deixava passar, em silencio, o
        // caso que mais importa: `RESEND_FROM_EMAIL` apontando para um dominio
        // ainda nao verificado (403), ou a API key rotacionada. A notificacao
        // no banco continuava chegando, entao a falha nao aparecia em lugar
        // nenhum. O envelope e `{ data, error }` (o `ResendClient` local e
        // frouxo de proposito, para nao acoplar o use case ao SDK).
        if (sendResult && typeof sendResult === "object" && "error" in sendResult && sendResult.error) {
          console.error("[bid] Resend recusou o e-mail de lance superado:", sendResult.error);
        }
      } catch (e) {
        console.error("[bid] falha ao enviar e-mail de lance superado:", e);
      }
    }
  }

  return { bid, outbidUserId };
}