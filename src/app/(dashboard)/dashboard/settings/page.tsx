import { getSession } from "@/presentation/actions/auth-actions";
import { SettingsForm } from "./settings-form";
import { BecomeSellerForm } from "@/components/become-seller-form";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  const isSeller = session?.user.role === "seller" || session?.user.role === "both";
  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" />
      <SettingsForm />
      {!isSeller ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Conta de leiloeiro</h2>
          <BecomeSellerForm />
        </section>
      ) : null}
    </div>
  );
}
