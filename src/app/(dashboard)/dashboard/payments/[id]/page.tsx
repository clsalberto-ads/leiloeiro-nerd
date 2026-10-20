import { notFound } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzlePaymentRepository } from "@/infrastructure/database/repositories/drizzle-payment-repository";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { isUuid } from "@/lib/uuid";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentView } from "./payment-view";
import { PageContainer } from "@/components/layout/page-container";

export const dynamic = "force-dynamic";

// ponytail: a página de pagamento é do ARREMATANTE — quem paga. O id vem do
// PATH: uuid inválido nem consulta (500 não é a resposta para endereço errado);
// pagamento inexistente ou de outra pessoa é 404 — o mesmo tratamento de
// privacidade da vitrine (getItemBySlugAndId), sem revelar que existe.
export default async function PaymentPage({ params }: PageProps<"/dashboard/payments/[id]">) {
  const [{ id }, session] = await Promise.all([params, getSession()]);
  if (!isUuid(id)) notFound();

  const payment = await drizzlePaymentRepository.findById(id);
  if (!payment || !session || payment.bidderId !== session.user.id) notFound();

  const item = await drizzleItemRepository.findById(payment.itemId);

  return (
    <PageContainer size="content">
<PageHeader
            title="Pagamento do arremate"
            description={item ? `Item: ${item.title}` : undefined}
          />
          <PaymentView
            paymentId={payment.id}
            initialStatus={payment.status}
            amountCents={payment.amount}
            qrCode={payment.pixQrCode}
            pixCopiaECola={payment.pixCopiaECola}
            paymentLink={payment.paymentLink}
            deadline={payment.deadline.toISOString()}
          />
      </PageContainer>
  );
}
