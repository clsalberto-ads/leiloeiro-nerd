import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { LayoutDashboard, Package, Settings, Star, Gavel, LogOut } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { signOutAction } from "@/presentation/actions/auth-actions";

interface DashboardSidebarMobileProps {
  onClose: () => void;
}

function NavItem({ href, icon: Icon, label, onClose }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; onClose?: () => void }) {
  return (
    <LinkButton
      href={href}
      variant="ghost"
      className="w-full justify-start gap-3 px-3 py-2.5 text-base"
      onClick={onClose}
    >
      <Icon className="h-5 w-5" />
      {label}
    </LinkButton>
  );
}

export function DashboardSidebar() {
  return (
    <aside className="hidden md:flex md:h-[calc(100vh-4rem)] md:w-64 md:flex-col md:border-r md:bg-card sticky top-0">
      <div className="flex h-16 items-center justify-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Gavel className="h-4 w-4" />
          </span>
          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Leiloeiro Nerd</span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Painel" />
        <NavItem href="/dashboard/items" icon={Package} label="Meus itens" />
        <NavItem href="/dashboard/favorites" icon={Star} label="Favoritos" />
        <NavItem href="/dashboard/my-bids" icon={Gavel} label="Meus lances" />
        <NavItem href="/dashboard/settings" icon={Settings} label="Configurações" />
      </nav>
      <Separator />
      <div className="p-3">
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" className="w-full justify-start gap-3 px-3 py-2.5 text-base text-muted-foreground hover:text-foreground">
            <LogOut className="h-5 w-5" />
            Sair
          </Button>
        </form>
      </div>
    </aside>
  );
}

export function DashboardSidebarMobile({ onClose }: DashboardSidebarMobileProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex h-16 items-center justify-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg tracking-tight" onClick={onClose}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Gavel className="h-4 w-4" />
          </span>
          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Leiloeiro Nerd</span>
        </Link>
      </div>
      <nav className="flex flex-col gap-2 flex-1">
      <NavItem href="/dashboard" icon={LayoutDashboard} label="Painel" onClose={onClose} />
      <NavItem href="/dashboard/items" icon={Package} label="Meus itens" onClose={onClose} />
      <NavItem href="/dashboard/favorites" icon={Star} label="Favoritos" onClose={onClose} />
      <NavItem href="/dashboard/my-bids" icon={Gavel} label="Meus lances" onClose={onClose} />
      <NavItem href="/dashboard/settings" icon={Settings} label="Configurações" onClose={onClose} />
      <Separator className="my-4" />
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" className="w-full justify-start gap-3 px-3 py-2.5 text-base text-muted-foreground hover:text-foreground">
          <LogOut className="h-5 w-5" />
          Sair
        </Button>
      </form>
    </nav>
  </div>
  );
}
