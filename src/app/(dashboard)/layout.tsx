import { redirect } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { PageContainer } from "@/components/layout/page-container";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <DashboardSidebar />
      <div className="flex flex-1 flex-col md:ml-64">
        <DashboardHeader userName={session.user.name} />
        <main className="flex-1 py-6">
          <PageContainer>{children}</PageContainer>
        </main>
      </div>
    </div>
  );
}
