import type { CreateItemInput, Item, ItemRepository } from "@/domain/repositories/item-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";

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
  if (input.minInitialBid < 100 || input.minBidIncrement < 100) {
    throw new Error("Lance mínimo deve ser de pelo menos R$ 1,00");
  }
  return itemRepo.create({ ...input, sellerId: userId });
}