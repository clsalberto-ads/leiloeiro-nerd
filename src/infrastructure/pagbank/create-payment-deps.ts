import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleBidRepository } from "@/infrastructure/database/repositories/drizzle-bid-repository";
import { drizzlePaymentRepository } from "@/infrastructure/database/repositories/drizzle-payment-repository";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { drizzleNotificationRepository } from "@/infrastructure/database/repositories/drizzle-notification-repository";
import { drizzlePagBankSellerAccountRepository } from "@/infrastructure/database/repositories/drizzle-pagbank-seller-account-repository";
import { createPixOrder, getPagBankOrder } from "@/infrastructure/pagbank/orders";
import { createResendClient } from "@/infrastructure/email/resend";
import { createPagBankCheckout } from "@/infrastructure/pagbank/checkout";
import { getValidPagBankAccessToken } from "@/infrastructure/pagbank/seller-access-token";

// ponytail: a montagem das dependências do `createPayment` para o PagBank.
// Mesmo desenho do MP — um composition root único que action e worker usam.
//
// O split de 5% funciona DIFERENTE do MP: o PagBank usa um ARRAY de receivers
// no nível da Order. A plataforma precisa do próprio account_id do PagBank
// (PAGBANK_ACCOUNT_ID no .env) para receber a taxa.
export function createPagBankPaymentDeps() {
  return {
    itemRepo: drizzleItemRepository,
    bidRepo: drizzleBidRepository,
    paymentRepo: drizzlePaymentRepository,
    userRepo: drizzleUserRepository,
    notifRepo: drizzleNotificationRepository,
    pagbankRepo: drizzlePagBankSellerAccountRepository,
    getAccessToken: (userId: string) =>
      getValidPagBankAccessToken(drizzlePagBankSellerAccountRepository, userId),
    getAccountId: async (userId: string) => {
      const creds = await drizzlePagBankSellerAccountRepository.findCredentials(userId);
      return creds?.accountId ?? null;
    },
    platformAccountId: process.env.PAGBANK_ACCOUNT_ID ?? "",
    notificationUrl:
      process.env.PAGBANK_WEBHOOK_URL ??
      `${process.env.PAGBANK_CONNECT_REDIRECT_URI?.replace("/api/pagbank/callback", "") ?? "http://localhost:3000"}/api/webhooks/pagbank`,
    createPix: createPixOrder,
    createCheckout: createPagBankCheckout,
    getOrder: getPagBankOrder,
    resend: process.env.RESEND_API_KEY ? createResendClient() : null,
  };
}

export function pagBankWebhookUrl(): string {
  return process.env.PAGBANK_WEBHOOK_URL ?? "http://localhost:3000/api/webhooks/pagbank";
}
