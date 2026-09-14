import { Button } from "@/components/ui/button";
import { getSession, signOutAction } from "@/presentation/actions/auth-actions";

export default async function DashboardPage() {
  const session = await getSession();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <form action={signOutAction}>
          <Button type="submit" variant="outline">Sair</Button>
        </form>
      </div>
      <p className="text-muted-foreground">
        Olá, {session?.user.name} · {session?.user.email} · Papel: {session?.user.role}
      </p>
    </div>
  );
}