import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Gavel } from "lucide-react";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Gavel className="h-5 w-5" />
        </span>
        <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Leiloeiro Nerd</span>
      </Link>
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
        <Link href="/#features" className="transition-colors hover:text-foreground">Recursos</Link>
        <Link href="/#benefits" className="transition-colors hover:text-foreground">Vantagens</Link>
        <Link href="/#stats" className="transition-colors hover:text-foreground">Plataforma</Link>
      </nav>
      <div className="flex items-center gap-3">
        <Button render={<Link href="/login">Entrar</Link>} variant="ghost" size="sm" />
        <Button render={<Link href="/register">Criar conta</Link>} size="sm" className="gap-1.5 shadow-sm" />
      </div>
    </header>
  );
}
