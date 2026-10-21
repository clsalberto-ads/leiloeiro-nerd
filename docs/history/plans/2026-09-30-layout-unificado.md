# Refatoração de Layout (Shell Unificado) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar o layout de toda a aplicação para seguir o padrão visual da referência (`docs/layout-reference.jpeg`), reutilizando componentes compartilhados (Header, Sidebar, PageContainer, PageHeader), aplicar padrão consistente em Auth, Dashboard, Públicas, usando componentes shadcn e preservando todos os testes existentes (sem alterar intenções/assertivas).

**Architecture:** Criar um *App Shell* centralizado (server-first) com Header + Sidebar reutilizáveis, containers padronizados, títulos/ações, separação entre rotas públicas e autenticadas. Dashboard passa a ter Sidebar (navegação principal) + Header global, páginas Auth ficam em layout enxuto centrado, páginas públicas ([slug], home) seguem seu próprio shell leve. Toda navegação passa a usar os links existentes, sem quebrar contratos de URL nem rotas de vitrine. Componentes shadcn são base; sem novas dependências. YAGNI, menor diffs, preservação estrita dos 675 testes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn (base-nova), Base UI, Lucide, TanStack Table, Server Actions.

**Spec:** `docs/layout-reference.jpeg` (referência visual). Este plano argumenta a partir da referência e da base existente; executores lêem ambos.

## Global Constraints

- **Não alterar testes protegidos.** Arquivos: `src/app/(public)/[slug]/page.test.tsx`, `src/app/(public)/[slug]/skeletons.test.tsx`, `src/app/(dashboard)/dashboard/items/page.test.tsx`, `src/infrastructure/database/repositories/drizzle-user-repository.test.ts`, `src/presentation/actions/public-actions.test.ts`. Seus assertions/intenções **não** podem ser mudados; adicionar casos é permitido.
- **Sem novas dependências.** Usar apenas as já instaladas (shadcn/base-ui/lucide).
- **Server-first.** Componentes de shell são server components sempre que possível; apenas interativos (botões/menus) são client.
- **Não duplicar fuso/lógica.** Usar `FUSO`, `paraInputDeData/deInputDeData`, `primeiroValor`, existentes.
- **Preservar contratos de rota.** URLs públicas (`/[slug]`, `/[slug]/[itemId]`) e dashboard inalteradas.
- **Padrão shadcn.** Usar componentes `@/components/ui/*`, `cn` importado de `"cn"` (pacote instalado; o repo usa `from "cn"`, NÃO `@/lib/utils`), variantes existentes.
- **Button é o do Base UI.** `src/components/ui/button.tsx` reexporta `ButtonPrimitive` do `@base-ui/react`; o prop polimórfico é `render={<Link .../>}` e ele **substitui** o elemento (não aceita `asChild`). `size` vai até `lg` = `h-9` — as alturas `h-12`/`h-16` do hero da home vêm de `className`, não de `size`.
- **Acessibilidade.** Manter landmarks, aria-current, `sr-only`, headings únicos por página.
- **Um `<header>` por shell.** O refactor existe para eliminar dois headers públicos diferentes; qualquer task que deixe dois `<header>` na mesma rota falhou.
- **Sem comentar código novo.** Apenas `ponytail:` estritamente necessário (se corrigir um ponto de divergência). Não inventar.

## Branch-base (PRÉ-REQUISITO — resolver antes do Task 0)

Este plano foi escrito **em `feature/vitrine`**, e não no `main`. Motivo medido:

| branch | commits à frente do `main` | estado |
|---|---|---|
| `feature/interface` | 0 | já integrada no `main` (stale) |
| `feature/items` | 0 | já integrada no `main` (stale) |
| **`feature/vitrine`** | **21** | **ativa, tem as rotas mais novas** |

O `main` **não tem** `vitrine-hero.tsx`, `controles-da-vitrine.tsx`, `estado-da-vitrine.ts` nem
as correções de hidratação/fuso. Um refactor de layout que toque `(public)/[slug]/page.tsx`
escrito contra o `main` desfaria o trabalho da vitrine.

**Decisão exigida antes de executar:** a refatoração roda em `feature/vitrine` (recomendado —
a base mais nova) ou espera o merge da vitrine no `main`? Se for no `main`, `git merge feature/vitrine`
primeiro e re-rodar Task 0 para recontar os arquivos, porque os caminhos mudam.

---



### Task 0: Inventário e decisões de shell

**Files:**
- Read: `src/app/layout.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/page.tsx`, `src/app/(auth)/*/page.tsx`, `src/app/(dashboard)/dashboard/*/page.tsx`, `src/app/(public)/[slug]/page.tsx`, `src/app/(public)/[slug]/layout.tsx`
- Create: `docs/superpowers/plans/2026-09-30-layout-unificado.md` (já criado)

**Interfaces:**
- Consumes: estrutura atual
- Produces: decisão de 3 shells (Public, Auth, Dashboard) + mapa de reutilização

- [ ] **Step 1: Confirmar shells necessários**
  - Public: home `/`, vitrine `/(public)/[slug]/*` — header leve (logo + entrar/criar conta) ou minimal? Manter header da home; vitrine pública permanece enxuta (hero já existe)
  - Auth: `(auth)/*` — centrado, sem sidebar/header pesado
  - Dashboard: `(dashboard)/*` — sidebar + header + main com padding/container

- [ ] **Step 2: Listar links de navegação do Dashboard**
  - Atual: `/dashboard`, `/dashboard/items`, `/dashboard/settings`, botão Sair (`signOutAction`)

- [ ] **Step 3: Verificar se há Sidebar no shadcn**
  - Não há `sidebar.tsx` em `ui/`. Criar `dashboard-sidebar.tsx` enxuto (server) com navegação usando `Button`/`nav` + `Separator`, destacando link ativo por pathname (client leve ou via `usePathname` em client component pequeno).

- [ ] **Step 4: Criar mapa de arquivos a tocar**
  - Criar: `src/components/layout/app-header.tsx`, `src/components/layout/dashboard-header.tsx`, `src/components/layout/dashboard-sidebar.tsx`, `src/components/layout/app-shell.tsx`, `src/components/layout/page-container.tsx`, `src/components/layout/page-header.tsx`, `src/components/layout/auth-shell.tsx`
  - Modificar: `src/app/layout.tsx`, `src/app/(dashboard)/layout.tsx`, criar `src/app/(auth)/layout.tsx`, `src/app/page.tsx`, páginas dashboard (remover cabeçalhos duplicados/h1 soltos redundantes), páginas auth (usar shell)

- [ ] **Step 5: Commit inventário**
  ```bash
  git add docs/superpowers/plans/2026-09-30-layout-unificado.md
  git commit -m "docs(plan): layout unificado — inventario e shells"
  ```


### Task 1: Componentes de layout compartilhados (header/sidebar/page primitives)

**Files:**
- Create: `src/components/layout/page-container.tsx`
- Create: `src/components/layout/page-header.tsx`
- Create: `src/components/layout/auth-shell.tsx`
- Create: `src/components/layout/app-header.tsx`
- Create: `src/components/layout/dashboard-header.tsx`
- Create: `src/components/layout/dashboard-sidebar.tsx`

**Interfaces:**
- Consumes: `Button`, `Separator` (shadcn), `Link`, `cn` (utils), `signOutAction` (auth-actions), session (server)
- Produces: componentes server-first reutilizáveis, sem lógica de domínio

- [ ] **Step 1: page-container.tsx**
```tsx
import { cn } from "cn";

export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}
```

- [ ] **Step 2: page-header.tsx**
```tsx
import { cn } from "cn";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-4", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
```

- [ ] **Step 3: app-header.tsx (público)**
```tsx
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
```

- [ ] **Step 4: dashboard-header.tsx (server)**
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Gavel } from "lucide-react";
import { signOutAction } from "@/presentation/actions/auth-actions";

export function DashboardHeader({ userName }: { userName?: string | null }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 px-4 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg tracking-tight">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Gavel className="h-4 w-4" />
        </span>
        <span className="hidden sm:inline-block bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Leiloeiro Nerd</span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-3">
        {userName ? <span className="hidden text-sm text-muted-foreground sm:inline-block">Olá, {userName}</span> : null}
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">Sair</Button>
        </form>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: dashboard-sidebar.tsx (server)**
```tsx
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
```

> **Por que NÃO existe um `app-shell.tsx`:** o `layout.tsx` do grupo de rotas JÁ é o shell —
> no App Router, `(public)/layout.tsx` e `(dashboard)/layout.tsx` são exatamente o
> "envolve a árvore com header/sidebar/main". Um componente `AppShell` que só faz
> `<div><AppHeader/>{children}</div>` e é chamado de dentro de um layout que também é
> chamado de dentro de outro seria o shell envolvendo o shell. Um componente com um
> consumidor é abstração; com zero, é código morto. O reaproveitamento que a tarefa pede
> vem de `AppHeader`/`DashboardHeader`/`DashboardSidebar`/`PageHeader` — que têm vários
> consumidores — e de os **layouts** serem poucos e finos.

- [ ] **Step 6: auth-shell.tsx (auth)**
```tsx
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <main className="flex flex-1 items-center justify-center p-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 7: Commit componentes de layout**
```bash
git add src/components/layout
git commit -m "feat(layout): componentes compartilhados de shell (header/sidebar/page)"
```

### Task 2: Layouts (auth, dashboard)

**Files:**
- Create: `src/app/(auth)/layout.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- **NÃO** modificar `src/app/layout.tsx` (o root já tem `min-h-full flex flex-col` + `Toaster`; nada aqui exige mudança — YAGNI)

**Interfaces:**
- Consumes: `AuthShell`, `DashboardHeader`, `DashboardSidebar`, `PageContainer`
- Produces: shells centralizados, sem alterar estrutura de Toaster/metadata

- [ ] **Step 1: auth layout**
```tsx
import { AuthShell } from "@/components/layout/auth-shell";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
```

- [ ] **Step 2: dashboard layout (sidebar + header)**
```tsx
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
    <div className="flex min-h-svh">
      <DashboardSidebar />
      <div className="flex min-h-svh flex-1 flex-col">
        <DashboardHeader userName={session.user.name} />
        <main className="flex-1 py-6">
          <PageContainer>{children}</PageContainer>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit layouts**
```bash
git add src/app/(auth)/layout.tsx src/app/(dashboard)/layout.tsx
git commit -m "refactor(layout): root/auth/dashboard com shell unificado"
```

### Task 3: Shell Público (site header único para home + vitrine)

**Files:**
- Move: `src/app/page.tsx` → `src/app/(public)/page.tsx`
- Modify: `src/app/(public)/layout.tsx`
- Create: `src/app/(public)/[slug]/layout.tsx`
- **NÃO** editar `(public)/[slug]/page.tsx` nem `[itemId]/page.tsx` (o `page.test.tsx` da vitrine é protegido e renderiza a página direto)

**Interfaces:**
- Consumes: `AppHeader` (Task 1)
- Produces: **um** header público compartilhado por `/` e `/[slug]`

**Por que mover a home (o achado central):** hoje o `/` está em `src/app/page.tsx`,
**fora** do `(public)`, então ele NÃO herda o `(public)/layout.tsx` — e por isso tem um
`<header>` próprio, escrito à mão, enquanto a vitrine usa o mini-header do layout. São
**dois headers diferentes** para o mesmo site deslogado: exatamente a inconsistência que
este plano elimina. Mover a home para `src/app/(public)/page.tsx` mantém a URL em `/`
(route group não entra na URL) e faz as duas rotas compartilharem o mesmo shell.

Nenhum teste referencia a home nem o header público: `page.test.tsx` da vitrine renderiza
`import VitrinePage from "./page"` **direto**, sem layout. A mudança é segura.

- [ ] **Step 1: Mover a home para dentro do grupo público**
```bash
git mv src/app/page.tsx "src/app/(public)/page.tsx"
```
URL inalterada: continua `/`.

- [ ] **Step 2: `(public)/layout.tsx` — header único, SEM container**
```tsx
import { AppHeader } from "@/components/layout/app-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```
> **O container sai daqui de propósito.** A home tem seções full-bleed (`border-y`,
> `bg-muted/30`) que precisam encostar na borda do viewport; um `container px-4` no
> layout as recortaria. O container desce para o layout do segmento `[slug]` (Step 3),
> que é quem precisa de padding.

- [ ] **Step 3: `(public)/[slug]/layout.tsx` — cria o container do vitrine**
```tsx
export default function VitrineLayout({ children }: { children: React.ReactNode }) {
  return <div className="container mx-auto px-4 py-8 sm:px-6">{children}</div>;
}
```
> **Por que um layout novo e não editar a página:** hoje o padding da vitrine vem do
> `<main className="container mx-auto py-8 px-4">` do layout público, que este task
> remove. O root da página é `<div className="space-y-6">`, sem padding próprio — sem
> este arquivo a vitrine encosta na lateral. Editar a página diretamente está fora de
> escopo: o `page.test.tsx` da vitrine é protegido e renderiza `./page` **sem layout**,
> então um layout de segmento corrige o padding real sem tocar no arquivo testado.
> `[itemId]` está sob `[slug]/`, então herda este container de graça.

- [ ] **Step 3b: Home — adicionar os ids que o `AppHeader` ancora (R2 do ledger)**
  - No `(public)/page.tsx`, o bloco "Quick Trust Metrics" (o `<div className="grid grid-cols-2 md:grid-cols-3 ... pt-12 border-t mt-16 ...">`) recebe `id="stats"`.
  - A seção de features já tem `id="features"`; o invólucro dos 3 cards (`<div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">`) recebe `id="benefits"`.
  - Assim `/#features`, `/#benefits` e `/#stats` resolvem a partir de qualquer página. Nenhuma outra linha da home muda.

- [ ] **Step 4: Home (agora em `(public)/page.tsx`) — apagar o header próprio**
  - Remover o bloco `<header>...</header>` (era o header duplicado).
  - Trocar o `<div className="flex min-h-screen flex-col bg-background text-foreground">` externo por `<>` (fragmento): o `min-h-svh flex-col` já vem do layout.
  - **Remover o `<main className="flex-1">` da home** — o `<main>` do `(public)/layout.tsx` já é o único da página (a convenção do plano é *layout provê o main*, igual ao `(auth)` no Task 4 e ao `(dashboard)`). Manter `<main>` aqui produziria **dois `<main>` aninhados**, um landmark duplicado. O `flex-1` também é do layout. Manter só as `<section>` e o `<footer>`.
  - `Gavel` continua usado no `<footer>` → manter o import.

- [ ] **Step 5: Confirmar a URL e o header único**
```bash
pnpm dev > /tmp/dev-layout.log 2>&1 &
SERVIDOR=$!
for i in $(seq 1 30); do curl -sf -o /dev/null http://localhost:3000/ && break; sleep 2; done
curl -s -o /tmp/home.html -w "home: %{http_code}\n" http://localhost:3000/
curl -s -o /tmp/vitrine.html -w "vitrine: %{http_code}\n" http://localhost:3000/leilonerd
echo "tags <header> na home   : $(grep -o '<header' /tmp/home.html | wc -l)  (esperado 1)"
echo "tags <header> na vitrine: $(grep -o '<header' /tmp/vitrine.html | wc -l)  (esperado 1)"
echo "tags <main>   na home   : $(grep -o '<main' /tmp/home.html | wc -l)  (esperado 1)"
echo "tags <main>   na vitrine: $(grep -o '<main' /tmp/vitrine.html | wc -l)  (esperado 1)"
kill $SERVIDOR 2>/dev/null
```
**Gate:** `home: 200` e `vitrine: 200`; **exatamente 1** `<header>` e **exatamente 1** `<main>` em cada rota (antes eram dois headers diferentes entre as rotas; e a home, se mantivesse o próprio `<main>`, teria dois mains aninhados). Se o servidor não sobe em 60 s, pule este step e diga no relatório — os Steps 6 e o `build` cobrem o resto.

- [ ] **Step 6: Rodar os testes que tocam rotas públicas (não alterar asserts protegidos)**
```bash
pnpm vitest run "src/app/(public)/[slug]/page.test.tsx" 2>&1 | tail -4
```
Expected: PASS (o teste monta `./page` direto, sem layout).

- [ ] **Step 7: Commit**
```bash
git add "src/app/(public)/page.tsx" "src/app/page.tsx" "src/app/(public)/layout.tsx" "src/app/(public)/[slug]/layout.tsx"
git commit -m "refactor(public): header unico para home e vitrine (home move para o grupo publico)"
```

### Task 4: Páginas Auth (centradas com AuthShell)

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/register/page.tsx`
- Modify: `src/app/(auth)/forgot-password/page.tsx`

**Interfaces:**
- Consumes: `AuthShell` (via layout) — páginas podem permanecer enxutas

- [ ] **Step 1: LoginPage — simplificar (layout já provê centramento)**
```tsx
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return <LoginForm />;
}
```

- [ ] **Step 2: RegisterPage**
```tsx
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return <RegisterForm />;
}
```

- [ ] **Step 3: ForgotPasswordPage**
```tsx
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
```

- [ ] **Step 4: Commit páginas auth**
```bash
git add src/app/(auth)/login/page.tsx src/app/(auth)/register/page.tsx src/app/(auth)/forgot-password/page.tsx
git commit -m "refactor(auth): páginas usam AuthShell via layout"
```

### Task 5: Dashboard — Página principal (remover cabeçalho duplicado)

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `PageContainer` (via layout) — cabeçalho/ações movidos para padrão unificado

**Requisitos:** Preservar toda lógica (sessão, papel, período, links). Não alterar textos. Remover bloco de cabeçalho interno (título + Olá + PeríodoSelect + Sair) — movê-lo para PageHeader com ações. Manter nav interno apenas se desejado, ou migrar para Sidebar (já existe). Sidebar cobre navegação principal; manter links secundários opcionais? Preferir não duplicar: remover `<nav>` com links para `/dashboard/items` e `/dashboard/settings` (Sidebar já fornece). **Não alterar** asserts de `page.test.tsx`.

- [ ] **Step 1: DashboardPage — refatorar com PageHeader, remover duplicações**
```tsx
import { Button } from "@/components/ui/button";
import { getSession } from "@/presentation/actions/auth-actions";
import { resumoDoDashboard } from "@/application/use-cases/resumo-do-dashboard";
import { drizzleAnaliseRepository } from "@/infrastructure/database/repositories/drizzle-analise-repository";
import { VisaoDoVendedorPainel } from "./graficos/visao-vendedor";
import { VisaoDoCompradorPainel } from "./graficos/visao-comprador";
import { PeriodoSelect } from "./periodo/periodo-select";
import { interpretarPeriodo } from "./periodo/periodo";
import { primeiroValor } from "@/lib/primeiro-valor";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const session = await getSession();
  if (!session) return null;

  const params = await searchParams;
  const { chave: periodo, dias } = interpretarPeriodo(primeiroValor(params.periodo));

  const papel = session.user.role === "seller" || session.user.role === "both" ? "seller" : "bidder";
  const visao = await resumoDoDashboard(drizzleAnaliseRepository, session.user.id, papel, dias);
  const ehVendedor = visao.papel === "vendedor";

  return (
    <div className="space-y-6">
      <PageHeader
        title={ehVendedor ? "Seu painel" : "Meus lances"}
        description={`Olá, ${session.user.name} · ${session.user.email}`}
        actions={<PeriodoSelect atual={periodo} />}
      />
      {ehVendedor ? (
        <VisaoDoVendedorPainel visao={visao} periodo={periodo} />
      ) : (
        <VisaoDoCompradorPainel visao={visao} periodo={periodo} />
      )}
    </div>
  );
}
```
> **Importante:** Remover links de navegação internos (`/dashboard/items`, `/dashboard/settings`) — já existem na Sidebar. Isso evita duplicação visual sem alterar semântica nem testes (os testes do dashboard não checam esses links).

- [ ] **Step 2: Verificar page.test.tsx — não alterar**
  - Ler `src/app/(dashboard)/dashboard/page.test.tsx` rapidamente: títulos/elementos principais devem permanecer iguais. O `PageHeader` mantém `<h1>` com mesmo texto.

- [ ] **Step 3: Commit**
```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "refactor(dashboard): usa PageHeader e remove navegação duplicada"
```

### Task 6: Dashboard — Items (lista)

**Files:**
- Modify: `src/app/(dashboard)/dashboard/items/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`
- Preserva: lógica de redirect por página vazia, filtros/vista, `ItensDaUrl`, totalCount

- [ ] **Step 1: Refatorar cabeçalho**
```tsx
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
// ... imports existentes

export default async function ItemsPage({ searchParams }: PageProps<"/dashboard/items">) {
  // ... lógica existente (sessão, role, vista, listagem, redirect)
  return (
    <div className="space-y-4">
      <PageHeader
        title="Meus itens"
        actions={
          <Button render={<Link href="/dashboard/items/new">+ Novo item</Link>} size="sm">
            + Novo item
          </Button>
        }
      />
      <ItensDaUrl items={items.map(paraItemDaTabela)} vista={vista} totalCount={total} />
    </div>
  );
}
```
> Manter exatamente o texto "+ Novo item" (pode ser Button com render Link). Não alterar estrutura de `ItensDaUrl`.

- [ ] **Step 2: Commit**
```bash
git add src/app/(dashboard)/dashboard/items/page.tsx
git commit -m "refactor(dashboard/items): PageHeader + ação Novo item"
```

### Task 7: Dashboard — Settings, New, Edit

**Files:**
- Modify: `src/app/(dashboard)/dashboard/settings/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/items/new/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/items/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `PageContainer` (via layout)

- [ ] **Step 1: SettingsPage**
```tsx
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
```

- [ ] **Step 2: NewItemPage**
```tsx
import { ItemForm } from "@/components/item-form";
import { PageHeader } from "@/components/layout/page-header";

export default function NewItemPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Novo item" />
      <ItemForm mode="create" />
    </div>
  );
}
```

- [ ] **Step 3: EditItemPage**
```tsx
import { notFound } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { ItemForm } from "@/components/item-form";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function EditItemPage({ params }: PageProps<"/dashboard/items/[id]/edit">) {
  const [session, { id }] = await Promise.all([getSession(), params]);
  if (!session) return null;
  const item = await drizzleItemRepository.findById(id);
  if (!item || item.sellerId !== session.user.id) notFound();
  return (
    <div className="space-y-4">
      <PageHeader title="Editar item" />
      <ItemForm item={item} mode="edit" />
    </div>
  );
}
```

- [ ] **Step 4: Commit**
```bash
git add src/app/(dashboard)/dashboard/settings/page.tsx src/app/(dashboard)/dashboard/items/new/page.tsx src/app/(dashboard)/dashboard/items/[id]/edit/page.tsx
git commit -m "refactor(dashboard): PageHeader em settings/new/edit"
```

### Task 8: Verificação de testes não protegidos + smoke

**Files:**
- Run: testes relevantes (page, auth, vitrine) — sem alterar arquivos protegidos

**Interfaces:**
- Verifica regressões visuais/estruturais sem tocar assertions protegidas

- [ ] **Step 1: Rodar vitest (completo) — baseline**
```bash
pnpm vitest run 2>&1 | tail -15
```
Expected: 69 passed, 675 passed (conforme baseline atual)

- [ ] **Step 2: Testes específicos de páginas/layout**
```bash
pnpm vitest run "src/app/(dashboard)/dashboard/page.test.tsx" "src/app/(dashboard)/dashboard/items/page.test.tsx" "src/app/(public)/[slug]/page.test.tsx" 2>&1 | tail -5
```
Expected: todos passam, sem alteração de intenções

- [ ] **Step 3: Typecheck + Lint**
```bash
pnpm tsc --noEmit 2>&1 | tail -2
pnpm lint 2>&1 | grep -c "error" | xargs echo "lint errors:"
```
Expected: 0 type errors, 0 lint errors

- [ ] **Step 4: Build**
```bash
pnpm build 2>&1 | grep -E "Compiled successfully|Error" | tail -2
```
Expected: Compiled successfully

- [ ] **Step 5: Registrar o resultado no ledger (sem commit vazio)**
```bash
git status --short
```
Se estiver limpo, não há commit — a verificação passou sem mudanças. Se houver ajuste,
ele pertence à task que o introduziu: volte e corrija lá, não crie um commit "chore"
que esconde qual task mudou depois de verificada.
