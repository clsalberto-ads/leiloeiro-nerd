import { redirect } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";

export const dynamic = "force-dynamic";

// ponytail: o shell do dashboard mora AQUI e SÓ aqui — `<main>` único da
// página, min-h-screen no topo, header/sidebar fixos. Cada página escolhe a
// largura do seu conteúdo com `<PageContainer size>` (a decisão deixou de ser
// classes soltas em dez arquivos). As páginas NÃO renderizam `<main>` nem
// `min-h-screen`: o duplicate <main> era dois landmarks e padding dobrado.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <DashboardSidebar />
      <div className="flex flex-1 flex-col md:ml-64">
        <DashboardHeader userName={session.user.name} />
        <main className="flex-1 py-6">{children}</main>
      </div>
    </div>
  );
}
