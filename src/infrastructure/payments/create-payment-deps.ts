import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleBidRepository } from "@/infrastructure/database/repositories/drizzle-bid-repository";
import { drizzlePaymentRepository } from "@/infrastructure/database/repositories/drizzle-payment-repository";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { drizzleNotificationRepository } from "@/infrastructure/database/repositories/drizzle-notification-repository";
import { drizzleMpSellerAccountRepository } from "@/infrastructure/database/repositories/drizzle-mp-seller-account-repository";
import { createMpCheckoutPreference, createMpPixPayment } from "@/infrastructure/mercado-pago/payments";
import { getValidSellerAccessToken } from "@/infrastructure/mercado-pago/seller-access-token";
import { createResendClient } from "@/infrastructure/email/resend";

// ponytail: a montagem das dependências do `createPayment` mora AQUI, num
// módulo SEM "use server" — a action de pagamento e o worker do cron usam
// ESTA função, e não duas cópias que divergem em silêncio. (Vivia na action,
// mas arquivo "use server" só pode EXPORTAR actions assíncronas — o build
// recusa qualquer outra exportação, e o Turbopack pegou.)
//
// SEM anotação de retorno de propósito: o retorno INFERIDO carrega o tipo
// COMPLETO do drizzleItemRepository (com setStatus e o resto), e é isso que
// deixa o worker montar o `handlePaymentWebhook` com o mesmo objeto. Uma
// anotação `: CreatePaymentDeps` estreitaria o tipo para o Pick mínimo e
// quebraria quem precisa de mais.
//
// O `resend` só existe com RESEND_API_KEY no ambiente: o cliente com chave
// ausente lança no primeiro envio, e "null" é o contrato dos use cases para
// "pular e-mail e seguir o fluxo".
export function createPaymentDeps() {
  return {
    itemRepo: drizzleItemRepository,
    bidRepo: drizzleBidRepository,
    paymentRepo: drizzlePaymentRepository,
    userRepo: drizzleUserRepository,
    notifRepo: drizzleNotificationRepository,
    getAccessToken: (userId: string) =>
      getValidSellerAccessToken(drizzleMpSellerAccountRepository, userId),
    mpClient: {
      createPixPayment: createMpPixPayment,
      createCheckoutPreference: createMpCheckoutPreference,
    },
    resend: process.env.RESEND_API_KEY ? createResendClient() : null,
  };
}
