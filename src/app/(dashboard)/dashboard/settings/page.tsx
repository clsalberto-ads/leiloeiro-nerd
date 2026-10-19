import { getSession } from "@/presentation/actions/auth-actions";
import { drizzleMpSellerAccountRepository } from "@/infrastructure/database/repositories/drizzle-mp-seller-account-repository";
import { SettingsForm } from "./settings-form";
import { BecomeSellerForm } from "@/components/become-seller-form";
import { MpAccountSection } from "./mp-account-section";
import { PageHeader } from "@/components/layout/page-header";

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
  const mpAccount =
    session && isSeller
      ? await drizzleMpSellerAccountRepository.findByUserId(session.user.id)
      : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
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
          <MpAccountSection
            account={
              mpAccount
                ? { connectedAt: mpAccount.connectedAt, mpUserId: mpAccount.mpUserId }
                : null
            }
            flash={typeof sp.mercadopago === "string" ? sp.mercadopago : undefined}
          />
        ) : null}
      </main>
    </div>
  );
}
