import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Package, Settings } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function DashboardSidebar() {
  return (
    <aside className="flex shrink-0 flex-row overflow-x-auto border-b bg-card md:h-full md:w-64 md:flex-col md:border-r md:border-b-0">
      <nav className="flex flex-1 flex-row gap-1 p-2 md:flex-col md:p-3">
        <Button nativeButton={false} render={<Link href="/dashboard" />} variant="ghost" className="justify-start gap-2">
          <LayoutDashboard className="h-4 w-4" /> Painel
        </Button>
        <Button nativeButton={false} render={<Link href="/dashboard/items" />} variant="ghost" className="justify-start gap-2">
          <Package className="h-4 w-4" /> Meus itens
        </Button>
        <Button nativeButton={false} render={<Link href="/dashboard/settings" />} variant="ghost" className="justify-start gap-2">
          <Settings className="h-4 w-4" /> Configurações
        </Button>
      </nav>
      <Separator className="hidden md:block" />
      <div className="hidden p-3 text-xs text-muted-foreground md:block">Leiloeiro Nerd</div>
    </aside>
  );
}
