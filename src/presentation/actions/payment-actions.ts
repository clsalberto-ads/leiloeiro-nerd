"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzlePaymentRepository } from "@/infrastructure/database/repositories/drizzle-payment-repository";
import { createPagBankPaymentDeps } from "@/infrastructure/pagbank/create-payment-deps";
import { createPayment } from "@/application/use-cases/create-payment";
import { isUuid } from "@/lib/uuid";
import { toActionError } from "@/lib/action-error";

export type PaymentActionResult = { ok?: boolean; error?: string };

/**
 * Gera (ou redevolve) a cobrança do arremate de um item ENCERRADO.
 * Autorização: o VENDEDOR dono do item — é a cobrança da conta Mercado Pago
 * dele que a plataforma cria. Idempotente no use case: clicar de novo devolve
 * o pagamento existente em vez de cobrar duas vezes.
 */
export async function createPaymentAction(
  itemId: string,
): Promise<PaymentActionResult & { paymentId?: string }> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  if (!isUuid(itemId)) return { error: "Item inválido" };

  try {
    const item = await drizzleItemRepository.findById(itemId);
    if (!item) return { error: "Item não encontrado" };
    if (item.sellerId !== session.user.id) return { error: "Sem permissão" };

    const payment = await createPayment(createPagBankPaymentDeps(), itemId);
    return { ok: true, paymentId: payment.id };
  } catch (err) {
    return { error: toActionError(err, "Não foi possível gerar a cobrança.") };
  }
}

export type PaymentStatusResult = {
  ok?: boolean;
  error?: string;
  status?: string;
  qrCode?: string | null;
  pixCopiaECola?: string | null;
  paymentLink?: string | null;
  deadline?: string;
};

/**
 * O estado atual do pagamento, para o polling da página (Fase C).
 * Autorização: o ARREMATANTE dono do pagamento — o QR/copia-e-cola é a
 * instrução de pagamento DELE; ninguém mais precisa dela.
 *
 * ponytail: leitura 100% LOCAL, sem tocar na MP. O polling roda a cada 10s:
 * consultar a API da MP em cada tick queimaria a cota do vendedor e bateria
 * no rate limit deles. A fonte da verdade muda por dois caminhos que já
 * existem no desenho: o WEBHOOK (Fase D, no instante do pagamento) e o cron
 * `sincronizar-mp` (Fase E, rede de segurança). A página só espelha o banco.
 */
export async function getPaymentStatusAction(
  paymentId: string,
): Promise<PaymentStatusResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  if (!isUuid(paymentId)) return { error: "Pagamento inválido" };

  const payment = await drizzlePaymentRepository.findById(paymentId);
  if (!payment || payment.bidderId !== session.user.id) {
    return { error: "Pagamento não encontrado" };
  }

  return {
    ok: true,
    status: payment.status,
    qrCode: payment.pixQrCode,
    pixCopiaECola: payment.pixCopiaECola,
    paymentLink: payment.paymentLink,
    deadline: payment.deadline.toISOString(),
  };
}

/**
 * Cancela a própria cobrança (o arrematante desiste antes de pagar).
 * Autorização: dono do pagamento. O cancelamento é LOCAL: o PIX pode seguir
 * válido na MP por alguns instantes — a sincronização (webhook/cron) resolve
 * o par logo depois, e a página para de aceitar o pagamento imediatamente.
 */
export async function cancelPaymentAction(paymentId: string): Promise<PaymentActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  if (!isUuid(paymentId)) return { error: "Pagamento inválido" };

  const payment = await drizzlePaymentRepository.findById(paymentId);
  if (!payment || payment.bidderId !== session.user.id) {
    return { error: "Pagamento não encontrado" };
  }
  if (payment.status !== "pending") {
    return { error: "Só é possível cancelar um pagamento pendente" };
  }

  const updated = await drizzlePaymentRepository.markCancelled(paymentId);
  if (!updated) return { error: "Não foi possível cancelar o pagamento." };
  return { ok: true };
}

// ponytail: as duas variantes de FORMULÁRIO traduzem o id do FormData e
// redirecionam, porque os formulários do dashboard (dropdown da lista de
// itens, página de pagamento) navegam — quem devolve `{ ok }` para um
// `<form action>` sem useActionState tem o resultado engolido pelo navegador.
// O parâmetro de flash (`?cobranca=`) é o FECHADO de propósito: só `gerada`
// e `erro` existem, e a mensagem da tela é fixa — query string nunca vira
// texto livre na página.
const DASHBOARD_ITEMS_PATH = "/dashboard/items";

export async function createPaymentFormAction(
  _prev: unknown,
  formData: FormData,
): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  const result = await createPaymentAction(itemId);
  if (result.ok) {
    revalidatePath(DASHBOARD_ITEMS_PATH);
    redirect(`${DASHBOARD_ITEMS_PATH}?cobranca=gerada`);
  }
  revalidatePath(DASHBOARD_ITEMS_PATH);
  redirect(`${DASHBOARD_ITEMS_PATH}?cobranca=erro`);
}

export async function cancelPaymentFormAction(
  _prev: unknown,
  formData: FormData,
): Promise<void> {
  const paymentId = String(formData.get("paymentId") ?? "");
  // O resultado decide nada aqui DE PROPÓSITO: o destino é a MESMA página,
  // que re-renderiza o estado atual (`cancelled` ou o erro visível do porquê
  // não cancelou — ex.: já aprovado). Cancelar com feedback é o estado, não
  // uma mensagem.
  await cancelPaymentAction(paymentId);
  revalidatePath(`/dashboard/payments/${paymentId}`);
  redirect(`/dashboard/payments/${paymentId}`);
}
