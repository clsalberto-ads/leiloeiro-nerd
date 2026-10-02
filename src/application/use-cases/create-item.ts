import type { CreateItemInput, Item, ItemRepository } from "@/domain/repositories/item-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import { createItemImages } from "./create-item-images";
import { invalidMoney, invalidPaymentDays } from "./money-guards";

const SELLER_ROLES = new Set(["seller", "both"]);

export async function createItem(
  itemRepo: ItemRepository,
  userRepo: UserRepository,
  userId: string,
  input: Omit<CreateItemInput, "sellerId">,
): Promise<Item> {
  const user = await userRepo.findById(userId);
  if (!user || !SELLER_ROLES.has(user.role)) {
    throw new Error("Apenas leiloeiros podem criar itens");
  }
  if (input.bidDeadline.getTime() <= Date.now()) {
    throw new Error("Prazo de lances deve ser no futuro");
  }
  if (invalidMoney(input.minInitialBid) || invalidMoney(input.minBidIncrement)) {
    throw new Error("Lance mínimo deve ser de pelo menos R$ 1,00");
  }
  if (invalidPaymentDays(input.paymentDeadlineDays)) {
    throw new Error("Prazo de pagamento deve ser entre 1 e 30 dias");
  }
  const item = await itemRepo.create({ ...input, sellerId: userId });
  if (input.imageUrls?.length) {
    await createItemImages(itemRepo, item.id, input.imageUrls);
  }
  return item;
}