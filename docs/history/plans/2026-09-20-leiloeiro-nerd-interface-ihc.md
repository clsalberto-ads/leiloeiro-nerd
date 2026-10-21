# Refinamento de Interface e Usabilidade (IHC + Conversão) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevar a interface do Leiloeiro Nerd em usabilidade (IHC), conversão e consistência técnica, sem alterar regras de negócio.

**Architecture:** Formulários migrados para React Hook Form + Zod com validação por campo em tempo real e vínculo semântico erro↔campo via componente `Field`. Listas do dashboard migradas para TanStack Table via `DataTable` genérico com estado na URL. Feedback efêmero via sonner; conversão via estrutura PAS na landing e prova social na vitrine.

**Tech Stack:** Next.js 16 (App Router, React 19), React Hook Form + `@hookform/resolvers/zod`, TanStack Table v8, shadcn/ui (base-nova, RSC), Tailwind v4, sonner, Vitest, Zod v4.

**Spec:** docs/superpowers/specs/2026-09-20-leiloeiro-nerd-interface-ihc-design.md

## Global Constraints

- Idioma da UI e mensagens de erro: **pt-BR**; valores monetários exibidos com **vírgula** (`R$ 1.234,56`) via `formatReais` existente
- Schemas Zod vivem em `src/lib/validators.ts` — **fonte única de verdade**; forms NÃO duplicam regras
- Server actions e regras de negócio **inalteradas**; RHF cuida apenas de estado e validação de campo no cliente
- Componentes shadcn novos são copiados para `src/components/ui/` (projeto usa `shadcn@4.21`, style `base-nova`, RSC ativo)
- Tokens CSS semânticos já existem (104 vars em `globals.css`) — nunca usar cor hardcoded
- Acessibilidade: `aria-invalid`, `aria-describedby` ligando erro ao campo; `role="alert"` em mensagens; alvos de toque ≥44px; foco visível
- Nenhum componente de teste既存 é removido; suíte deve crescer, nunca encolher
- Commits por task: `feat:` / `refactor:` / `fix:`

---

### Task 1: Dependências + componentes base (form, sonner, skeleton)

**Files:**
- Modify: `package.json` (deps)
- Create: `src/components/ui/form.tsx` (via shadcn CLI)
- Create: `src/components/ui/skeleton.tsx` (via shadcn CLI)
- Modify: `src/app/layout.tsx` (montar `<Toaster />`)

**Interfaces:**
- Produces: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`, `FormDescription` (shadcn); `Skeleton`; `<Toaster richColors position="top-right" />` montado no layout raiz.

- [ ] **Step 1: Instalar dependências**

```bash
pnpm add react-hook-form @hookform/resolvers @tanstack/react-table @tanstack/react-pagination sonner
```

- [ ] **Step 2: Adicionar componentes shadcn**

```bash
pnpm dlx shadcn@latest add form skeleton sonner alert
```

Os componentes são copiados para `src/components/ui/`. Não editar o output manualmente nesta task.

- [ ] **Step 3: Montar Toaster no layout raiz**

Em `src/app/layout.tsx`, adicionar import e elemento:

```tsx
import { Toaster } from "@/components/ui/sonner";
```

```tsx
<body className="min-h-full flex flex-col">
  {children}
  <Toaster richColors position="top-right" closeButton />
</body>
```

- [ ] **Step 4: Verificação + commit**

Run: `npx next typegen && npx tsc --noEmit && pnpm test`
Expected: PASS (tipos de `sonner` e `form` resolvidos)

```bash
git add package.json pnpm-lock.yaml src/components/ui/form.tsx src/components/ui/skeleton.tsx src/components/ui/sonner.tsx src/components/ui/alert.tsx src/app/layout.tsx
git commit -m "feat(ui): componentes shadcn form, skeleton, sonner + Toaster no layout"
```

---

### Task 2: Componente `Field` — vínculo semântico erro↔campo

**Files:**
- Create: `src/components/field.tsx`
- Test: `src/components/field.test.tsx`

**Interfaces:**
- Produces:
```tsx
interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => React.ReactNode;
}
export function Field({ id, label, error, hint, children }: FieldProps): React.ReactElement
```

Comportamento: renderiza `<Label htmlFor={id}>`; quando `error` existe, o filho recebe `aria-invalid={true}` e `aria-describedby` apontando para o id da mensagem; mensagem com `role="alert"` e `id={id}-error`; `hint` com `id={id}-hint`.

- [ ] **Step 1: Teste (RED)**

```tsx
// src/components/field.test.tsx
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Input } from "@/components/ui/input";
import { Field } from "./field";

describe("Field", () => {
  it("vincula a mensagem de erro ao input via aria-describedby", () => {
    const html = renderToString(
      <Field id="title" label="Título" error="Título deve ter no mínimo 3 caracteres">
        {(p) => <input {...p} name="title" />}
      </Field>,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="title-error"');
    expect(html).toContain('id="title-error"');
    expect(html).toContain('role="alert"');
  });

  it("não marca aria-invalid quando não há erro", () => {
    const html = renderToString(
      <Field id="title" label="Título">{(p) => <input {...p} name="title" />}</Field>,
    );
    expect(html).not.toContain('aria-invalid="true"');
  });
});
```

- [ ] **Step 2: Rodar teste (RED)**

Run: `pnpm test -- run src/components/field.test.tsx`
Expected: FAIL — módulo `./field` não existe.

- [ ] **Step 3: Implementar**

```tsx
// src/components/field.tsx
"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

interface FieldRenderProps {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: (props: FieldRenderProps) => ReactNode;
}

export function Field({ id, label, error, hint, children }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Rodar teste (GREEN)**

Run: `pnpm test -- run src/components/field.test.tsx`
Expected: PASS (2 testes)

- [ ] **Step 5: Verificação + commit**

Run: `npx tsc --noEmit && pnpm lint`
```bash
git add src/components/field.tsx src/components/field.test.tsx
git commit -m "feat(ui): componente Field com vínculo semântico erro↔campo"
```

---

### Task 3: Migrar `item-form.tsx` para React Hook Form

**Files:**
- Modify: `src/components/item-form.tsx` (124 linhas)
- Test: `src/components/item-form.test.tsx`

**Interfaces:**
- Consumes: `Field` (Task 2), `itemSchema` de `@/lib/validators`, `createItemAction`/`updateItemAction` (inalterados), `uploadItemImagesAction` (inalterado)
- Produces: `ItemForm` com o mesmo contrato de props `{ item?: Item | null; mode: "create" | "edit" }`

Regras: RHF gerencia estado e validação; a submissão continua indo para a server action via `useActionState`. Valores monetários continuam em **reais no input** (o schema converte para centavos). `locked`, upload de imagens e `imageUrls` hidden seguem como estão.

- [ ] **Step 1: Teste (RED)**

```tsx
// src/components/item-form.test.tsx
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ItemForm } from "./item-form";

describe("ItemForm", () => {
  it("renderiza rótulos de todos os campos obrigatórios", () => {
    const html = renderToString(<ItemForm mode="create" />);
    expect(html).toContain("Título");
    expect(html).toContain("Descrição");
    expect(html).toContain("Lance mínimo (R$)");
    expect(html).toContain("Prazo para lances");
  });
});
```

- [ ] **Step 2: Rodar teste (RED)**

Run: `pnpm test -- run src/components/item-form.test.tsx`
Expected: PASS já (o componente atual renderiza os rótulos) — este teste é de regressão de renderização, não de falha. Passe para Step 3 mantendo-o como guarda de que a migração não remove rótulos.

- [ ] **Step 3: Migrar para RHF**

Regras de migração (aplicar sobre `item-form.tsx`):
- `import { useForm } from "react-hook-form";` e `import { zodResolver } from "@hookform/resolvers/zod";`
- `const form = useForm<z.input<typeof itemSchema>>({ resolver: zodResolver(itemSchema), mode: "onBlur", defaultValues: { type: "product", paymentDeadlineDays: 3, ...campos do item } })`
- `mode: "onBlur"`; após o primeiro erro o RHF revalida em `onChange` (comportamento padrão do `reValidateMode: "onChange"`)
- Cada campo passa a ser `{...form.register("title")}` dentro de `<Field id="title" label="Título" error={form.formState.errors.title?.message}>`
- `disabled={locked}` preservado em todos os campos
- `<form action={formAction}>` **permanece** — RHF não substitui a submissão por server action; o `formAction` do `useActionState` continua sendo o submit
- Envio dos valores em reais: `setValueAs: (v) => Number(v)` não se aplica (inputs `type="number"` já entregam string); o `itemSchema` usa `z.coerce.number()` — manter o input como está
- Bloco de erro da action (linha 53) permanece para erros de servidor (ex.: slug duplicado)

- [ ] **Step 4: Rodar teste + suíte (GREEN)**

Run: `pnpm test -- run src/components/item-form.test.tsx && pnpm test`
Expected: PASS — suíte completa sem regressões

- [ ] **Step 5: Verificação + commit**

Run: `npx tsc --noEmit && pnpm lint && pnpm build`
```bash
git add src/components/item-form.tsx src/components/item-form.test.tsx
git commit -m "refactor(ui): item-form com React Hook Form e validação por campo"
```

---

### Task 4: Migrar forms de autenticação (login, register, forgot-password)

**Files:**
- Modify: `src/app/(auth)/login/login-form.tsx`
- Modify: `src/app/(auth)/register/register-form.tsx`
- Modify: `src/app/(auth)/forgot-password/forgot-password-form.tsx`
- Test: `src/app/(auth)/register/register-form.test.tsx`

**Interfaces:**
- Consumes: `Field` (Task 2), `signUpSchema`/`signInSchema`/`forgotPasswordSchema` de `@/lib/validators`
- Produces: mesmos componentes com o mesmo contrato; erros por campo; erro de servidor (credenciais inválidas/e-mail duplicado) permanece em bloco no topo

- [ ] **Step 1: Teste (RED)**

```tsx
// src/app/(auth)/register/register-form.test.tsx
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RegisterForm } from "./register-form";

describe("RegisterForm", () => {
  it("rótulos associados aos inputs", () => {
    const html = renderToString(<RegisterForm />);
    expect(html).toContain('for="name"');
    expect(html).toContain('for="email"');
    expect(html).toContain('for="password"');
  });
});
```

- [ ] **Step 2: Rodar teste**

Run: `pnpm test -- run src/app/\(auth\)/register/register-form.test.tsx`
Expected: PASS (guarda de renderização) ou FAIL se `for=` não estiver presente no HTML — se falhar, isso indica que o `Label` não está associado; corrija adicionando `htmlFor`/`id` coerentes.

- [ ] **Step 3: Migrar os três forms**

Para cada um: `useForm` + `zodResolver(<schema>)`, `mode: "onBlur"`, cada campo envolvido em `<Field>`, erros exibidos via `Field`. O `<form action={action}>` de `useActionState` permanece como mecanismo de submissão.

- [ ] **Step 4: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint`
```bash
git add src/app/\(auth\)/login/login-form.tsx src/app/\(auth\)/register/register-form.tsx src/app/\(auth\)/register/register-form.test.tsx src/app/\(auth\)/forgot-password/forgot-password-form.tsx
git commit -m "refactor(ui): forms de auth com RHF e validação por campo"
```

---

### Task 5: Migrar `bid-form` e `become-seller-form` para RHF

**Files:**
- Modify: `src/components/bid-form.tsx` (40 linhas)
- Modify: `src/components/become-seller-form.tsx` (40 linhas)
- Test: `src/components/bid-form.test.tsx`

**Interfaces:**
- Consumes: `Field` (Task 2), `placeBidSchema`, `becomeSellerSchema`
- Produces: mesmos contratos de props

Regras específicas:
- `bid-form.tsx` mantém o campo `amount` **em reais** (o hidden `itemId` continua); o `placeBidSchema` já converte
- `become-seller-form.tsx` mantém a pré-visualização do slug via `createSlug` em `useMemo` sobre o valor atual

- [ ] **Step 1: Teste (RED)**

```tsx
// src/components/bid-form.test.tsx
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { BidForm } from "./bid-form";

describe("BidForm", () => {
  it("rótulo do campo de lance", () => {
    const html = renderToString(<BidForm itemId="i1" minBid={5000} />);
    expect(html).toContain("Seu lance");
  });
});
```

- [ ] **Step 2: Rodar, migrar, verificar**

Run: `pnpm test -- run src/components/bid-form.test.tsx`
Expected: FAIL (`BidForm` pode ter assinatura diferente — ajuste a props do teste à assinatura real do componente antes de continuar), depois PASS.

- [ ] **Step 3: Migrar ambos com RHF + Field**

- [ ] **Step 4: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint && pnpm build`
```bash
git add src/components/bid-form.tsx src/components/bid-form.test.tsx src/components/become-seller-form.tsx
git commit -m "refactor(ui): bid-form e become-seller-form com RHF"
```

---

### Task 6: Componentes shadcn de tabela

**Files:**
- Create: `src/components/ui/table.tsx`, `dropdown-menu.tsx`, `select.tsx`, `checkbox.tsx`, `popover.tsx`, `badge.tsx`, `separator.tsx`, `tooltip.tsx` (via CLI)

**Interfaces:**
- Produces: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`; `DropdownMenu*`; `Select*`; `Checkbox`; `Popover*`; `Badge`; `Separator`; `Tooltip*`

- [ ] **Step 1: Adicionar componentes**

```bash
pnpm dlx shadcn@latest add table dropdown-menu select checkbox popover badge separator tooltip
```

- [ ] **Step 2: Migrar `item-status-badge.tsx` para o `badge` do shadcn**

Reescrever `src/components/item-status-badge.tsx` usando `Badge` do shadcn, preservando o mapa de rótulos pt-BR e as classes de cor existentes. Remover o `<span>` manual. Atualizar importações em `items-list.tsx` e `[itemId]/page.tsx` se o caminho mudar.

- [ ] **Step 3: Verificação + commit**

Run: `npx tsc --noEmit && pnpm test && pnpm lint`
```bash
git add src/components/ui/ src/components/item-status-badge.tsx src/app src/components
git commit -m "feat(ui): componentes shadcn de tabela e badge unificado"
```

---

### Task 7: Componente `DataTable` genérico

**Files:**
- Create: `src/components/data-table.tsx`
- Test: `src/components/data-table.test.tsx`

**Interfaces:**
- Consumes: TanStack `useReactTable`, `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`, `getPaginationRowModel`; componentes `table.tsx` (Task 6)
- Produces:
```tsx
export interface DataTableColumn<T> {
  id: string;
  header: string;
  accessorFn?: (row: T) => unknown;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  enableSorting?: boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  pageSize?: number;
  pageIndex?: number;
  onPageChange?: (page: number) => void;
  onSortChange?: (sort: { id: string; desc: boolean } | null) => void;
  onFilterChange?: (query: string) => void;
  filterPlaceholder?: string;
  emptyMessage?: string;
  manualPagination?: boolean;
  totalCount?: number;
}

export function DataTable<T>(props: DataTableProps<T>): React.ReactElement
```

Comportamento: ordenação por clique no header (com `aria-sort`), campo de busca com debounce de 300ms, paginação com seletor de tamanho de página, empty state quando `data.length === 0`, colunas ordenáveis desabilitadas com `enableSorting: false`.

- [ ] **Step 1: Teste (RED)**

```tsx
// src/components/data-table.test.tsx
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { DataTable, type DataTableColumn } from "./data-table";

interface Row { id: string; title: string }
const columns: DataTableColumn<Row>[] = [
  { id: "title", header: "Título", accessorFn: (r) => r.title, cell: (r) => r.title, sortable: true },
];
const data: Row[] = [{ id: "1", title: "Item A" }];

describe("DataTable", () => {
  it("renderiza headers e linhas", () => {
    const html = renderToString(<DataTable columns={columns} data={data} />);
    expect(html).toContain("Título");
    expect(html).toContain("Item A");
  });

  it("mostra mensagem de vazio quando não há dados", () => {
    const html = renderToString(<DataTable columns={columns} data={[]} emptyMessage="Nenhum item" />);
    expect(html).toContain("Nenhum item");
  });
});
```

- [ ] **Step 2: Rodar teste (RED)**

Run: `pnpm test -- run src/components/data-table.test.tsx`
Expected: FAIL — módulo `./data-table` não existe.

- [ ] **Step 3: Implementar `DataTable`**

Usar `"use client"`. Estrutura: `<div>` com input de busca (label `aria-label="Buscar"`), `<Table>` com `<TableHeader>` iterando `table.getHeaderGroups()` e `<TableBody>` iterando `table.getRowModel().rows`, chamando `column.cell` com a linha original. Paginação: botões "Anterior"/"Próxima" com `disabled` nos limites + `<Select>` de tamanho de página. Ordenação: `header.column.getToggleSortingHandler()` com `aria-sort` reflecting `getIsSorted()`.

- [ ] **Step 4: Rodar teste (GREEN)**

Run: `pnpm test -- run src/components/data-table.test.tsx`
Expected: PASS (2 testes)

- [ ] **Step 5: Verificação + commit**

Run: `npx tsc --noEmit && pnpm lint`
```bash
git add src/components/data-table.tsx src/components/data-table.test.tsx
git commit -m "feat(ui): DataTable genérico com ordenação, busca e paginação"
```

---

### Task 8: Refatorar `items-list.tsx` para DataTable

**Files:**
- Modify: `src/app/(dashboard)/dashboard/items/items-list.tsx` (71 linhas)
- Test: `src/app/(dashboard)/dashboard/items/items-list.test.tsx` (existente — manter)

**Interfaces:**
- Consumes: `DataTable` (Task 7), `ItemStatusBadge` (Task 6)
- Produces: `ItemsList` com props `{ items: Item[]; current: string; totalCount?: number }` e callbacks de ordenação/paginação/filtro opcionais; mantém as actions inline (`publishItemAction`, `deleteItemAction`, `cancelItemAction`)

Regras: colunas `Título` (com link para edit), `Tipo`, `Status` (badge), `Lance mínimo` (`formatReais`), `Deadline` (formatado), `Ações` (dropdown com Publicar/Excluir/Cancelar). Remover o filtro client-side de status (linha 22) — passa a ser controlado pela URL.

- [ ] **Step 1: Ajustar teste existente (guarda)**

O teste existente `items-list.test.tsx` verifica o `BidCountdown`. Ampliar com uma verificação de header de tabela:

```tsx
it("renderiza as colunas da tabela", () => {
  const html = renderToString(<ItemsList items={[makeItem()]} current="all" />);
  expect(html).toContain("Lance mínimo");
});
```

- [ ] **Step 2: Rodar teste (RED)**

Run: `pnpm test -- run src/app/\(dashboard\)/dashboard/items/items-list.test.tsx`
Expected: FAIL — "Lance mínimo" ainda não é header de tabela.

- [ ] **Step 3: Refatorar para DataTable**

- [ ] **Step 4: Rodar teste (GREEN) + suíte**

Run: `pnpm test -- run src/app/\(dashboard\)/dashboard/items/items-list.test.tsx && pnpm test`
Expected: PASS

- [ ] **Step 5: Verificação + commit**

Run: `npx tsc --noEmit && pnpm lint && pnpm build`
```bash
git add src/app/\(dashboard\)/dashboard/items/items-list.tsx src/app/\(dashboard\)/dashboard/items/items-list.test.tsx
git commit -m "refactor(ui): items-list com DataTable, ordenação, busca e paginação"
```

---

### Task 9: Estado da tabela na URL + paginação server-side

**Files:**
- Modify: `src/app/(dashboard)/dashboard/items/page.tsx`
- Modify: `src/application/use-cases/list-seller-items.ts`
- Modify: `src/domain/repositories/item-repository.ts` (contrato do filtro)
- Test: `src/application/use-cases/list-seller-items.test.ts`

**Interfaces:**
- Produces: `ItemListFilter` estendido com `q?: string`, `orderBy?: "createdAt" | "title" | "minInitialBid"`, `direction?: "asc" | "desc"`, `limit?: number`, `offset?: number`
- `listSellerItems(repo, sellerId, filter)` respeita ordenação, busca textual e paginação; retorna `{ items, total }` — **mudança de contrato breaking** (retorno passa a ser objeto)

Racional IHC: estado no URL permite back/forward do browser e link compartilhável para uma vista filtrada (controle do usuário).

- [ ] **Step 1: Atualizar teste (RED)**

```ts
it("ordena por lance mínimo quando solicitado", async () => {
  const { items } = await listSellerItems(repo, "u1", { orderBy: "minInitialBid", direction: "asc" });
  expect(items.map((i) => i.minInitialBid)).toEqual([1000, 5000]);
});

it("filtra por busca textual no título", async () => {
  const { items } = await listSellerItems(repo, "u1", { q: "raro" });
  expect(items).toHaveLength(1);
});

it("pagina com limit e offset", async () => {
  const { items, total } = await listSellerItems(repo, "u1", { limit: 1, offset: 0 });
  expect(items).toHaveLength(1);
  expect(total).toBe(2);
});
```

- [ ] **Step 2: Rodar (RED)** — Expected: FAIL (retorno ainda é `Item[]`, filtro não existe)

- [ ] **Step 3: Implementar** — extender `ItemListFilter`, aplicar ordenação/where/limit no repositório Drizzle, retornar `{ items, total }` com `count()`.

- [ ] **Step 4: Atualizar `items/page.tsx`** para ler `searchParams` (`q`, `status`, `order`, `dir`, `page`) e passar ao `ItemsList`; `<Link>` para mudança de página preservando os demais parâmetros.

- [ ] **Step 5: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint && pnpm build`
```bash
git add src/app/\(dashboard\)/dashboard/items/page.tsx src/application/use-cases/list-seller-items.ts src/domain/repositories/item-repository.ts src/infrastructure/database/repositories/drizzle-item-repository.ts src/application/use-cases/list-seller-items.test.ts
git commit -m "feat(ui): estado da tabela na URL e paginação server-side de itens"
```

---

### Task 10: Skeletons e empty states

**Files:**
- Modify: `src/app/(public)/[slug]/page.tsx`
- Modify: `src/app/(public)/[slug]/[itemId]/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/items/page.tsx`
- Modify: `src/components/data-table.tsx` (empty state com ícone)
- Create: `src/components/empty-state.tsx`

**Interfaces:**
- Produces: `EmptyState({ title, description, action?: { label, href } })`; `ItemCardSkeleton` para a vitrine; `TableSkeleton` para o dashboard

- [ ] **Step 1: Criar `empty-state.tsx`**

```tsx
import type { ReactNode } from "react";
import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; href: string };
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      {icon}
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? (
        <Link href={action.href} className="text-sm font-medium text-primary underline">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Aplicar skeletons e empty states**

Substituir os `<p>Nenhum item…</p>` por `EmptyState` com ação. Adicionar `<Suspense fallback={<ItemCardSkeleton />}>` nas listas públicas.

- [ ] **Step 3: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint && pnpm build`
```bash
git add src/components/empty-state.tsx src/components/data-table.tsx src/app
git commit -m "feat(ui): skeletons e empty states com ação nas listas"
```

---

### Task 11: Toasts para erros e sucessos

**Files:**
- Modify: `src/components/item-form.tsx`
- Modify: `src/components/bid-section.tsx`
- Modify: `src/app/(dashboard)/dashboard/items/items-list.tsx`
- Test: `src/components/item-form.test.tsx` (ampliar)

**Interfaces:**
- Consumes: `toast` de `sonner`
- Produces: erros de upload e de action via `toast.error(...)`; sucesso de lance/pagamento via `toast.success(...)`; "PIX copiado" via `toast.success("PIX copiado")`

- [ ] **Step 1: Teste**

```tsx
it("mantém a mensagem de erro de upload acessível", () => {
  const html = renderToString(<ItemForm mode="create" />);
  expect(html).toContain("Enviar");
});
```

- [ ] **Step 2: Implementar toasts**

Substituir os `<p className="text-destructive">` de erro de upload por `toast.error(uploadState.error)` disparado em `useEffect` quando `uploadState?.error` mudar. Manter também o bloco acessível no formulário (o toast não substitui a mensagem no DOM para leitores de tela).

- [ ] **Step 3: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint`
```bash
git add src/components src/app
git commit -m "feat(ui): toasts para erros e sucessos de upload, lance e pagamento"
```

---

### Task 12: Acessibilidade do countdown e dos status

**Files:**
- Modify: `src/components/bid-countdown.tsx`
- Modify: `src/components/item-status-badge.tsx`
- Test: `src/components/bid-countdown.test.tsx`

**Interfaces:**
- Produces: `BidCountdown` com container `aria-live="polite"` e `role="timer"`, rótulo textual do prazo ("encerra em X"); respeita `prefers-reduced-motion`; `ItemStatusBadge` com `role="status"`

- [ ] **Step 1: Teste (RED)**

```tsx
it("anuncia o prazo com aria-live", () => {
  const html = renderToString(<BidCountdown deadline={new Date(Date.now() + 3600_000)} />);
  expect(html).toContain('aria-live="polite"');
});
```

- [ ] **Step 2: Rodar (RED)** — Expected: FAIL (sem `aria-live`)

- [ ] **Step 3: Implementar** — envolver o texto do countdown em `<span role="timer" aria-live="polite">`; adicionar `<span className="sr-only">Prazo: {formattedDeadline}</span>` para o valor absoluto; respeitar `prefers-reduced-motion` com `@media (prefers-reduced-motion: reduce)` desabilitando a animação de pulso.

- [ ] **Step 4: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint`
```bash
git add src/components/bid-countdown.tsx src/components/bid-countdown.test.tsx src/components/item-status-badge.tsx
git commit -m "feat(a11y): countdown com aria-live e badges com role=status"
```

---

### Task 13: Landing page com estrutura de conversão (PAS)

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css` (tokens de animação já existentes; apenas utilitários se necessário)
- Test: `src/app/page.test.tsx`

**Interfaces:**
- Produces: `Home()` com seções: header/nav, hero (PAS + CTA primário único), barra de confiança, "como funciona" (3 passos), CTA final, footer

Estrutura (marketing-skills, sem anti-padrões):
- **PAS no hero:** Problema ("Leilões online são confusos e cheios de ruído") → Agitação ("Sem prazo claro, sem garantia, sem histórico") → Solução ("Leiloeiro Nerd: prazo real, pagamento por PIX, lance mínimo visível") → Ação (CTA primário **único**)
- **Barra de confiança:** 3 selos com `lucide-react` (ShieldCheck "Pagamento por PIX", Clock "Prazo real de encerramento", Shield "Lance mínimo protegido")
- **3 passos:** "Crie sua conta" → "Publique seu item" → "Receba lances"
- CTA primário: `<Button size="lg">Começar a leiloar</Button>` (único acima do fold); secundário vira link textual discreto

- [ ] **Step 1: Teste (RED)**

```tsx
// src/app/page.test.tsx
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import Home from "./page";

describe("Home", () => {
  it("tem um único CTA primário e proposta de valor", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("Começar a leiloar");
    expect(html.match(/Começar a leiloar/g)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar (RED)** — Expected: FAIL

- [ ] **Step 3: Implementar** — reescrever `page.tsx` com as seções; `export const metadata` com `title` e `description` em pt-BR.

- [ ] **Step 4: Verificação + commit**

Run: `pnpm test -- run src/app/page.test.tsx && pnpm test && npx tsc --noEmit && pnpm lint && pnpm build`
```bash
git add src/app/page.tsx src/app/page.test.tsx src/app/globals.css
git commit -m "feat(marketing): landing com estrutura PAS, CTA único e barra de confiança"
```

---

### Task 14: Prova social e hierarquia na vitrine e no item

**Files:**
- Modify: `src/app/(public)/[slug]/page.tsx`
- Modify: `src/app/(public)/[slug]/[itemId]/page.tsx`
- Modify: `src/components/public-item-card.tsx`
- Test: `src/app/(public)/[slug]/page.test.tsx`

**Interfaces:**
- Produces: cabeçalho de vitrine com nome do seller + contagem de itens ativos + lotes encerrados; card com lance atual em destaque; empty state com CTA "Anunciar o primeiro item"

- [ ] **Step 1: Teste (RED)**

```tsx
it("mostra prova social na vitrine", () => {
  const html = renderToString(<VitrinePage />);
  expect(html).toMatch(/itens? (ativos?|em leilão)/i);
});
```

- [ ] **Step 2: Rodar (RED)** — Expected: FAIL

- [ ] **Step 3: Implementar** — cabeçalho da vitrine com métricas reais calculadas do repositório (não inventadas — sem número falso); `PublicItemCard` destaca o lance mínimo atual; empty state com ação.

- [ ] **Step 4: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint && pnpm build`
```bash
git add src/app/\(public\) src/components/public-item-card.tsx
git commit -m "feat(marketing): prova social na vitrine e hierarquia de lance em destaque"
```

---

### Task 15: Sugestão de lance na página de item

**Files:**
- Modify: `src/app/(public)/[slug]/[itemId]/bid-section.tsx`
- Modify: `src/components/bid-form.tsx`
- Test: `src/components/bid-form.test.tsx` (ampliar)

**Interfaces:**
- Produces: o `BidForm` exibe `Mínimo: R$ X` e um botão secundário "Usar mínimo" que preenche o campo com o valor mínimo válido (reduz fricção — marketing-skills: "specific, low-friction next step")

- [ ] **Step 1: Teste (RED)**

```tsx
it("oferece preencher com o lance mínimo", () => {
  const html = renderToString(<BidForm itemId="i1" minBid={5000} />);
  expect(html).toContain("Usar mínimo");
});
```

- [ ] **Step 2: Rodar (RED)** — Expected: FAIL

- [ ] **Step 3: Implementar** — botão `type="button"` que chama `setValue("amount", (minBid / 100).toFixed(2))` via RHF.

- [ ] **Step 4: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint`
```bash
git add src/app/\(public\)/\[slug\]/\[itemId\]/bid-section.tsx src/components/bid-form.tsx src/components/bid-form.test.tsx
git commit -m "feat(ui): sugestão de lance mínimo para reduzir fricção"
```

---

### Task 16: Densidade mobile e alvos de toque

**Files:**
- Modify: `src/app/(public)/[slug]/page.tsx` (grid da vitrine)
- Modify: `src/app/(dashboard)/dashboard/items/items-list.tsx` (tabelas → cards em mobile)
- Modify: `src/components/ui/button.tsx` (altura mínima)
- Modify: `src/components/bid-history.tsx`
- Modify: `src/app/layout.tsx` (skip-link)

**Interfaces:**
- Produzes: `Button` com `min-h-11` (44px) por padrão; grid da vitrine com densidade progressiva; `DataTable` renderizando cards abaixo de `sm`; skip-link "Pular para o conteúdo"

- [ ] **Step 1: Teste (RED)**

```tsx
it("renderiza skip-link para o conteúdo principal", () => {
  const html = renderToString(<SkipLink />);
  expect(html).toContain("Pular para o conteúdo");
});
```

- [ ] **Step 2: Rodar (RED)** — Expected: FAIL

- [ ] **Step 3: Implementar** — `Button` com `min-h-11`; grid responsivo; tabela com `hidden sm:table` e versão em cards com `sm:hidden`; skip-link no layout com `sr-only focus:not-sr-only`.

- [ ] **Step 4: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint && pnpm build`
```bash
git add src/app src/components
git commit -m "feat(ui): alvos de toque 44px, tabelas responsivas e skip-link"
```

---

### Task 17: Auditoria de teclado e landmarks

**Files:**
- Modify: `src/app/layout.tsx` (landmarks `header`/`main`/`footer`)
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(public)/layout.tsx`
- Modify: `src/components/ui/dropdown-menu.tsx` (foco gerenciado pelo shadcn — verificar)
- Test: `src/app/layout.test.tsx`

**Interfaces:**
- Produces: exatamente um `<main>` por página; `<header>` e `<footer>` sem duplicação; dropdowns fecham com `Esc` e devolvem foco ao gatilho (comportamento padrão do shadcn — verificar, não reimplementar)

- [ ] **Step 1: Teste (RED)**

```tsx
it("tem exatamente um main", () => {
  const html = renderToString(<Layout>{children}</Layout>);
  expect(html.match(/<main/g)).toHaveLength(1);
});
```

- [ ] **Step 2: Rodar (RED)** — Expected: FAIL se houver main duplicado

- [ ] **Step 3: Implementar** — garantir `main` único; envolver conteúdo em landmarks corretos; `aria-label` no `<nav>`.

- [ ] **Step 4: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint`
```bash
git add src/app src/components/ui
git commit -m "fix(a11y): landmarks semânticos e main único por página"
```

---

### Task 18: Auditoria axe + contraste

**Files:**
- Create: `scripts/a11y-audit.ts` (ou `src/lib/a11y/audit.ts`)
- Modify: `package.json` (script `a11y`)

**Interfaces:**
- Produces: `pnpm a11y` que sobe o servidor, percorre as rotas e reporta violações; falha se houver violação crítica

- [ ] **Step 1: Adicionar dependência de auditoria**

```bash
pnpm add -D @axe-core/cli
```

- [ ] **Step 2: Criar script**

```json
{
  "scripts": {
    "a11y": "start-server-and-test start http://localhost:3000 a11y:run",
    "a11y:run": "axe http://localhost:3000 http://localhost:3000/login http://localhost:3000/register --exit"
  }
}
```

Ajustar ao script `start` existente do projeto.

- [ ] **Step 3: Executar e corrigir violações**

Run: `pnpm a11y` → corrigir até zero violações críticas (contraste AA, nomes acessíveis, landmarks).

- [ ] **Step 4: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint && pnpm build && pnpm a11y`
```bash
git add package.json pnpm-lock.yaml scripts src
git commit -m "test(a11y): auditoria axe com exit em violações críticas"
```

---

### Task 19: Testes de interação e verificação final

**Files:**
- Create: `src/components/field.test.tsx` (garantir cobertura de hint)
- Create: `src/components/data-table.test.tsx` (ampliar: ordenação)
- Create: `src/app/(public)/[slug]/page.test.tsx` (garantir empty state)
- Modify: `docs/project.md` (marcar Fase 4: refinamento de interface)

**Interfaces:**
- Produces: suíte completa passando; Fase 4 do roadmap com os itens de interface marcados

- [ ] **Step 1: Ampliar testes**

Adicionar a `data-table.test.tsx`: renderização com coluna não ordenável (`enableSorting: false`); com `emptyMessage`.
Adicionar a `field.test.tsx`: `hint` renderizado com `aria-describedby` correto quando não há erro.

- [ ] **Step 2: Rodar suíte completa**

Run: `pnpm test`
Expected: PASS, suíte maior que a baseline (145 testes)

- [ ] **Step 3: Verificação completa**

Run: `npx next typegen && npx tsc --noEmit && pnpm lint && pnpm build`
Expected: todos limpos

- [ ] **Step 4: Atualizar roadmap + commit**

```bash
# Em docs/project.md, marcar os itens de interface da Fase 4:
# - [x] Dashboard do arrematante
# - [x] Refinamento de formulários (validação por campo)
# - [x] Listas com filtro e paginação
# - [x] Estados de carregamento e vazio
# - [x] Acessibilidade (teclado, leitor de tela, contraste)
git add docs/project.md
git commit -m "docs: atualiza roadmap pós refinamento de interface"
```

---

## Checklist de cobertura do spec

| Requisito do spec | Tasks |
|---|---|
| Deps + componentes base | 1, 6 |
| `Field` com vínculo erro↔campo | 2 |
| Formulários com RHF | 3, 4, 5 |
| DataTable genérico | 7 |
| DataTable no dashboard + URL + server-side | 8, 9 |
| Skeletons e empty states | 10 |
| Toasts | 11 |
| `aria-live`, `role=status`, reduced-motion | 12 |
| Conversão: landing PAS, prova social, sugestão de lance | 13, 14, 15 |
| Mobile e alvos de toque | 16 |
| Teclado e landmarks | 17 |
| axe + contraste | 18 |
| Testes de interação + roadmap | 19 |
