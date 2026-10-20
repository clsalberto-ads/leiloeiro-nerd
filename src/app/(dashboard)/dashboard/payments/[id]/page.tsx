import { notFound } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzlePaymentRepository } from "@/infrastructure/database/repositories/drizzle-payment-repository";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { isUuid } from "@/lib/uuid";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentView } from "./payment-view";

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
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
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
        </div>
      </main>
    </div>
  );
}
