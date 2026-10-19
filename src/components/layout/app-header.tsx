import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Gavel, LayoutDashboardIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { signOutAction } from "@/presentation/actions/auth-actions";

// ponytail: `userName` vem do LAYOUT (que lê a sessão), e não de um
// `getSession()` aqui dentro — o mesmo desenho do `DashboardHeader`. Assim o
// header continua um componente presentational puro: roda no teste sem mock
// de headers/auth (o `native-button-semantics.test.tsx` renderiza o ramo
// anônimo), e a decisão de "quem está logado" mora em um lugar só.
//
// O ramo logado troca "Entrar/Criar conta" por saudação + atalho ao painel +
// Sair. Sem isto, quem entrava numa vitrine vinda do dashboard não tinha como
// voltar ao painel nem sair — e via "Criar conta" estando logado.
export function AppHeader({ userName }: { userName?: string | null }) {
  const loggedIn = Boolean(userName);

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-backdrop-filter:bg-background/60">
      <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Gavel className="h-5 w-5" />
        </span>
        <span className="bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Leiloeiro Nerd</span>
      </Link>
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
        <Link href="/#features" className="transition-colors hover:text-foreground">Recursos</Link>
        <Link href="/#benefits" className="transition-colors hover:text-foreground">Vantagens</Link>
        <Link href="/#stats" className="transition-colors hover:text-foreground">Plataforma</Link>
      </nav>
      <div className="flex items-center gap-3">
        {/* ponytail: o sino só faz sentido para quem tem conta — para um
            visitante anônimo ele é um ícone que acorda a cada 10s para
            perguntar ao servidor "há notificações?" e a resposta é sempre não. */}
        {loggedIn ? <NotificationBell /> : null}
        <ThemeToggle />
        {loggedIn ? (
          <>
            <span className="hidden text-sm text-muted-foreground sm:inline-block">Olá, {userName}</span>
            <Button
              nativeButton={false}
              render={<Link href="/dashboard" />}
              variant="ghost"
              size="sm"
            >
              <LayoutDashboardIcon data-icon="inline-start" aria-hidden="true" />
              Painel
            </Button>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">Sair</Button>
            </form>
          </>
        ) : (
          <>
            <Button nativeButton={false} render={<Link href="/login">Entrar</Link>} variant="ghost" size="sm" />
            <Button nativeButton={false} render={<Link href="/register">Criar conta</Link>} size="sm" className="gap-1.5 shadow-sm" />
          </>
        )}
      </div>
    </header>
  );
}
