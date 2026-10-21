import { getSession } from "@/presentation/actions/auth-actions";
import { drizzlePagBankSellerAccountRepository } from "@/infrastructure/database/repositories/drizzle-pagbank-seller-account-repository";
import { SettingsForm } from "./settings-form";
import { BecomeSellerForm } from "@/components/become-seller-form";
import { PagBankAccountSection } from "./pagbank-account-section";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: PageProps<"/dashboard/settings">) {
  const [session, sp] = await Promise.all([getSession(), searchParams]);
  const isSeller =
    session?.user.role === "seller" || session?.user.role === "both";

  // ponytail: `findByUserId` é a porta SEM token — a página de configurações
  // só pode conhecer o ESTADO da conexão. Sessão ausente ou papel de comprador
  // não consultam nada: a seção só existe para quem vende.
  const pagbankAccount =
    session && isSeller
      ? await drizzlePagBankSellerAccountRepository.findByUserId(session.user.id)
      : null;

  return (
    <PageContainer size="default">
<PageHeader title="Configurações" />
        {session ? (
          <SettingsForm
            profile={{
              name: session.user.name,
              slug: session.user.slug ?? null,
              phone: session.user.phone ?? null,
              address: session.user.address ?? null,
            }}
          />
        ) : null}

        {!isSeller ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Conta de leiloeiro</h2>
            <BecomeSellerForm />
          </section>
        ) : null}

        {isSeller ? (
          <PagBankAccountSection
            account={
              pagbankAccount
                ? { connectedAt: pagbankAccount.connectedAt, accountId: pagbankAccount.accountId }
                : null
            }
            flash={typeof sp.pagbank === "string" ? (sp.pagbank as string) : undefined}
          />
        ) : null}
      </PageContainer>
  );
}
