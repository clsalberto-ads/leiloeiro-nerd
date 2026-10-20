import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleBidRepository } from "@/infrastructure/database/repositories/drizzle-bid-repository";
import { drizzlePaymentRepository } from "@/infrastructure/database/repositories/drizzle-payment-repository";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { drizzleNotificationRepository } from "@/infrastructure/database/repositories/drizzle-notification-repository";
import { drizzleMpSellerAccountRepository } from "@/infrastructure/database/repositories/drizzle-mp-seller-account-repository";
import { createMpPixPayment } from "@/infrastructure/mercado-pago/payments";
import { getValidSellerAccessToken } from "@/infrastructure/mercado-pago/seller-access-token";
import type { CreatePaymentDeps } from "@/application/use-cases/create-payment";

// ponytail: a montagem das dependências do `createPayment` mora AQUI, num
// módulo SEM "use server" — a action de pagamento e o worker do cron usam
// ESTA função, e não duas cópias que divergem em silêncio. (Vivia na action,
// mas arquivo "use server" só pode EXPORTAR actions assíncronas — o build
// recusa qualquer outra exportação, e o Turbopack pegou.)
export function createPaymentDeps(): CreatePaymentDeps {
  return {
    itemRepo: drizzleItemRepository,
    bidRepo: drizzleBidRepository,
    paymentRepo: drizzlePaymentRepository,
    userRepo: drizzleUserRepository,
    notifRepo: drizzleNotificationRepository,
    getAccessToken: (userId: string) =>
      getValidSellerAccessToken(drizzleMpSellerAccountRepository, userId),
    mpClient: { createPixPayment: createMpPixPayment },
  };
}
