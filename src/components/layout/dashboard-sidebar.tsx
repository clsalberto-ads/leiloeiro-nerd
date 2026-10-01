import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Package, Settings } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function DashboardSidebar() {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-card">
      <nav className="flex flex-1 flex-col gap-1 p-3">
        <Button render={<Link href="/dashboard">Painel</Link>} variant="ghost" className="justify-start gap-2">
          <LayoutDashboard className="h-4 w-4" /> Painel
        </Button>
        <Button render={<Link href="/dashboard/items">Meus itens</Link>} variant="ghost" className="justify-start gap-2">
          <Package className="h-4 w-4" /> Meus itens
        </Button>
        <Button render={<Link href="/dashboard/settings">Configurações</Link>} variant="ghost" className="justify-start gap-2">
          <Settings className="h-4 w-4" /> Configurações
        </Button>
      </nav>
      <Separator />
      <div className="p-3 text-xs text-muted-foreground">Leiloeiro Nerd</div>
    </aside>
  );
}