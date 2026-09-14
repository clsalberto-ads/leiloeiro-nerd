import { redirect } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <main className="mx-auto max-w-5xl p-6">{children}</main>;
}