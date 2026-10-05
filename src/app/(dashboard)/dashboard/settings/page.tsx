import { getSession } from "@/presentation/actions/auth-actions";
import { SettingsForm } from "./settings-form";
import { BecomeSellerForm } from "@/components/become-seller-form";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  const isSeller = session?.user.role === "seller" || session?.user.role === "both";
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
    </main>
    </div>
  );
}
