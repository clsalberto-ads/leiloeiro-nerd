# Sub-projeto 2c: Lances + Notificações + Countdown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sistema de lances (server actions + polling), notificações "lance superado" (Resend + in-app), e integração completa do countdown na página de detalhe.

**Architecture:** Server Actions + polling 10s (sem WebSocket/SSE). Validações server-side. Notificações via Resend + tabela notifications. Rank automático no insert. Countdown já existente integrado.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Drizzle ORM, UploadThing, Better Auth, Resend, Tailwind + shadcn/ui (base-ui), Vitest.

**Spec:** docs/superpowers/specs/2026-09-18-leiloeiro-nerd-bidding-design.md

## Global Constraints

- Idioma: pt-BR (UI, mensagens, erros)
- TypeScript strict, sem comentários exceto se solicitado
- Valores monetários em centavos (integer)
- `PageProps<Route>` helper global Next 16 para tipar `params`/`searchParams` (Promise)
- `searchParams` = `Promise<{ [key: string]: string \| string[] \| undefined }>` — requer `await`
- shadcn/ui com base-ui usa prop `render` NÃO `asChild`
- Polling 10s via `setInterval` + server action `getItemBidsAction`
- TDD obrigatório para use cases e validações
- Commits por task com mensagens convencionais (`feat:`, `fix:`, `docs:`)
- Race condition: transação DB com lock ou version otimista

---

### Task 1: BidRepository — `createBid` com rank automático

**Files:**
- Modify: `src/domain/repositories/bid-repository.ts` (add `createBid` method)
- Modify: `src/infrastructure/database/repositories/drizzle-bid-repository.ts` (implement `createBid`)
- Test: `src/infrastructure/database/repositories/drizzle-bid-repository.test.ts` (novo)

**Interfaces:**
- Consumes: `Bid`, `CreateBidInput` (já existem em `bid-repository.ts`)
- Produces: `BidRepository.createBid(input: CreateBidInput) → Promise<Bid>` — insere com `rank = (max rank existente) + 1` ou 1 se vazio

- [ ] **Step 1: Adicionar método ao contrato**

Em `bid-repository.ts`, adicionar ao interface `BidRepository`:

```ts
export interface BidRepository {
  findByItemId(itemId: string): Promise<Bid[]>;
  createBid(input: CreateBidInput): Promise<Bid>;
}
```

- [ ] **Step 2: Implementar no repositório Drizzle**

Em `drizzle-bid-repository.ts`, adicionar import `max` do `drizzle-orm` e implementar:

```ts
async createBid(input: CreateBidInput) {
  const existingMaxRank = await db
    .select({ maxRank: max(bids.rank) })
    .from(bids)
    .where(eq(bids.itemId, input.itemId));
  const rank = (existingMaxRank[0]?.maxRank ?? 0) + 1;
  const [row] = await db
    .insert(bids)
    .values({ ...input, rank })
    .returning();
  return {
    id: row.id,
    itemId: row.itemId,
    bidderId: row.bidderId,
    bidderName: row.bidderId, // placeholder; use case resolve nome real
    amount: row.amount,
    rank: row.rank,
    createdAt: row.createdAt,
  };
},
```

- [ ] **Step 3: Teste unitário do repo (TDD)**

Criar `drizzle-bid-repository.test.ts` com fake e testar:
- `createBid` retorna rank 1 quando vazio
- `createBid` retorna rank N+1 quando já existem lances
- `findByItemId` ordena por `amount DESC` (maior primeiro)

Run: `pnpm test --run src/infrastructure/database/repositories/drizzle-bid-repository.test.ts`

- [ ] **Step 4: Verificação + commit**

Run: `npx next typegen && npx tsc --noEmit && pnpm test`

```bash
git add src/domain/repositories/bid-repository.ts src/infrastructure/database/repositories/drizzle-bid-repository.ts src/infrastructure/database/repositories/drizzle-bid-repository.test.ts
git commit -m "feat: BidRepository.createBid com rank automático"
```

---

### Task 2: NotificationRepository — create outbid

**Files:**
- Create: `src/domain/repositories/notification-repository.ts`
- Create: `src/infrastructure/database/repositories/drizzle-notification-repository.ts`
- Test: `src/infrastructure/database/repositories/drizzle-notification-repository.test.ts`

**Interfaces:**
- Produces: `NotificationRepository.create(input: CreateNotificationInput) → Promise<Notification>`
- `CreateNotificationInput`: `{ userId: string; type: "outbid"; title: string; content: string }`

- [ ] **Step 1: Contrato `NotificationRepository`**

Criar `notification-repository.ts`:

```ts
export type NotificationType = "outbid" | "won" | "payment_due" | "payment_expired" | "payment_confirmed";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  read: boolean;
  createdAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
}

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<Notification>;
  // findByUserId, markAsRead, etc. — future tasks
}
```

- [ ] **Step 2: Implementação Drizzle**

Criar `drizzle-notification-repository.ts` usando tabela `notifications` (já existe no schema):

```ts
export const drizzleNotificationRepository: NotificationRepository = {
  async create(input) {
    const [row] = await db
      .insert(notifications)
      .values({ ...input, read: false })
      .returning();
    return {
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      content: row.content,
      read: row.read,
      createdAt: row.createdAt,
    };
  },
};
```

- [ ] **Step 3: Teste + commit**

Run: `pnpm test && npx tsc --noEmit`

```bash
git add src/domain/repositories/notification-repository.ts src/infrastructure/database/repositories/drizzle-notification-repository.ts src/infrastructure/database/repositories/drizzle-notification-repository.test.ts
git commit -m "feat: NotificationRepository para outbid"
```

---

### Task 3: Use Case `place-bid` (TDD)

**Files:**
- Create: `src/application/use-cases/place-bid.ts`
- Create: `src/application/use-cases/place-bid.test.ts`

**Interfaces:**
- Consumes: `ItemRepository`, `BidRepository`, `UserRepository`, `NotificationRepository`, `ResendClient` (via `better-auth` ou direto)
- Produces: `placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, bidderId, itemId, amount) → Promise<{ bid: Bid; outbidUserId?: string }>`
- Erros: "Item não encontrado", "Item não está em leilão", "Leilão encerrado", "Lance deve ser ≥ lance mínimo inicial", "Lance deve ser ≥ lance atual + incremento mínimo", "Você não pode dar lance no próprio item", "Apenas arrematantes podem dar lances"

- [ ] **Step 1: Teste TDD (RED)**

Criar `place-bid.test.ts` com fakes. Testes:
- Cria lance válido (primeiro lance ≥ minInitialBid)
- Rejeita lance < minInitialBid
- Cria lance subsequente ≥ maiorLance + minBidIncrement
- Rejeita lance < maiorLance + minBidIncrement
- Rejeita se item status ≠ active
- Rejeita se deadline passou
- Rejeita se bidder === seller
- Rejeita se user role ≠ bidder|both
- Retorna `{ bid, outbidUserId }` quando supera lance anterior
- Dispara `notificationRepo.create(outbid)` quando há outbid

Run: `pnpm test --run src/application/use-cases/place-bid.test.ts` → Expected: FAIL

- [ ] **Step 2: Implementação (GREEN)**

`place-bid.ts`:

```ts
export async function placeBid(
  itemRepo: ItemRepository,
  bidRepo: BidRepository,
  userRepo: UserRepository,
  notifRepo: NotificationRepository,
  resend: ResendClient,
  bidderId: string,
  itemId: string,
  amount: number,
) {
  const item = await itemRepo.findById(itemId);
  if (!item) throw new Error("Item não encontrado");
  if (item.status !== "active") throw new Error("Item não está em leilão");
  if (item.bidDeadline.getTime() <= Date.now()) throw new Error("Leilão encerrado");
  if (item.sellerId === bidderId) throw new Error("Você não pode dar lance no próprio item");
  const bidder = await userRepo.findById(bidderId);
  if (!bidder || !["bidder", "both"].includes(bidder.role)) throw new Error("Apenas arrematantes podem dar lances");

  const existingBids = await bidRepo.findByItemId(itemId);
  const highestBid = existingBids[0]; // já ordenado por amount DESC
  const minBid = highestBid ? highestBid.amount + item.minBidIncrement : item.minInitialBid;
  if (amount < minBid) {
    const minReais = (minBid / 100).toFixed(2);
    throw new Error(`Lance deve ser ≥ R$ ${minReais}`);
  }

  const bid = await bidRepo.createBid({ itemId, bidderId, amount });

  let outbidUserId: string | undefined;
  if (highestBid && highestBid.bidderId !== bidderId) {
    outbidUserId = highestBid.bidderId;
    await notifRepo.create({
      userId: outbidUserId,
      type: "outbid",
      title: "Lance superado",
      content: `Seu lance de R$ ${(highestBid.amount / 100).toFixed(2)} em ${item.title} foi superado por R$ ${(amount / 100).toFixed(2)}`,
    });
    // Resend email — best effort
    try {
      const outbidUser = await userRepo.findById(outbidUserId);
      if (outbidUser?.email) {
        await resend.emails.send({
          from: "Leiloeiro Nerd <noreply@leiloeironerd.com>",
          to: outbidUser.email,
          subject: "Seu lance foi superado!",
          html: `<p>Seu lance de R$ ${(highestBid.amount / 100).toFixed(2)} em <strong>${item.title}</strong> foi superado por <strong>R$ ${(amount / 100).toFixed(2)}</strong>.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL}/${item.seller?.slug}/${item.id}">Dar novo lance</a></p>`,
        });
      }
    } catch (e) {
      console.error("[Resend] falha ao enviar outbid:", e);
    }
  }

  return { bid, outbidUserId };
}
```

- [ ] **Step 3: Verificação**

Run: `pnpm test --run src/application/use-cases/place-bid.test.ts` → GREEN

Run: `pnpm test && npx tsc --noEmit`

```bash
git add src/application/use-cases/place-bid.ts src/application/use-cases/place-bid.test.ts
git commit -m "feat: use case place-bid com validações e notificação outbid"
```

---

### Task 4: Use Case `get-item-bids` (TDD)

**Files:**
- Create: `src/application/use-cases/get-item-bids.ts`
- Create: `src/application/use-cases/get-item-bids.test.ts`

**Interfaces:**
- Produces: `getItemBids(bidRepo, userRepo, itemId) → Promise<Bid[]>`
- Retorna bids ordenados por `amount DESC` (maior primeiro), com `bidderName` resolvido via `userRepo.findById`

- [ ] **Step 1: Teste TDD**

Testes: retorna bids ordenados por amount DESC; resolve bidderName via userRepo; fallback para bidderId se user não encontrado.

- [ ] **Step 2: Implementação**

```ts
export async function getItemBids(
  bidRepo: BidRepository,
  userRepo: UserRepository,
  itemId: string,
): Promise<Bid[]> {
  const bids = await bidRepo.findByItemId(itemId);
  const bidsWithNames = await Promise.all(bids.map(async (bid) => {
    const user = await userRepo.findById(bid.bidderId);
    return { ...bid, bidderName: user?.name ?? bid.bidderId };
  }));
  return bidsWithNames;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/application/use-cases/get-item-bids.ts src/application/use-cases/get-item-bids.test.ts
git commit -m "feat: use case get-item-bids com resolução de nomes"
```

---

### Task 5: Server Actions — `placeBidAction` + `getItemBidsAction`

**Files:**
- Create: `src/presentation/actions/bid-actions.ts`
- Modify: `src/lib/validators.ts` (add `placeBidSchema`)

**Interfaces:**
- `placeBidAction(_prev, formData) → { ok?: boolean; error?: string; bid?: Bid }`
- `getItemBidsAction(_prev, formData) → { bids?: Bid[]; error?: string }`

- [ ] **Step 1: Validators**

Em `validators.ts`:

```ts
export const placeBidSchema = z.object({
  itemId: z.string().uuid(),
  amount: z.coerce.number().positive("Lance inválido").refine(v => v >= 100, "Lance mínimo R$ 1,00"),
});
```

- [ ] **Step 2: Server Actions**

```ts
"use server";
import { getSession } from "./auth-actions";
import { formToObject, placeBidSchema } from "@/lib/validators";
import { placeBid } from "@/application/use-cases/place-bid";
import { getItemBids } from "@/application/use-cases/get-item-bids";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleBidRepository } from "@/infrastructure/database/repositories/drizzle-bid-repository";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { drizzleNotificationRepository } from "@/infrastructure/database/repositories/drizzle-notification-repository";
import { createResendClient } from "@/infrastructure/email/resend";

export type BidActionResult = { ok?: boolean; error?: string; bid?: any; bids?: any[] };

export async function placeBidAction(_prev: BidActionResult | null, formData: FormData): Promise<BidActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const parsed = placeBidSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const resend = createResendClient();
  try {
    const result = await placeBid(
      drizzleItemRepository,
      drizzleBidRepository,
      drizzleUserRepository,
      drizzleNotificationRepository,
      resend,
      session.user.id,
      parsed.data.itemId,
      parsed.data.amount,
    );
    return { ok: true, bid: result.bid };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao registrar lance" };
  }
}

export async function getItemBidsAction(_prev: BidActionResult | null, formData: FormData): Promise<BidActionResult> {
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return { error: "Item ID obrigatório" };
  try {
    const bids = await getItemBids(drizzleBidRepository, drizzleUserRepository, itemId);
    return { ok: true, bids };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao buscar lances" };
  }
}
```

- [ ] **Step 3: Resend Client**

Criar `src/infrastructure/email/resend.ts`:

```ts
import { Resend } from "resend";

export function createResendClient() {
  return new Resend(process.env.RESEND_API_KEY);
}
```

- [ ] **Step 4: Verificação + commit**

Run: `pnpm test && npx next typegen && npx tsc --noEmit && pnpm lint`

```bash
git add src/presentation/actions/bid-actions.ts src/lib/validators.ts src/infrastructure/email/resend.ts
git commit -m "feat: server actions de lances (placeBid + getItemBids)"
```

---

### Task 6: Polling na Página de Detalhe + Form de Lance

**Files:**
- Modify: `src/app/(public)/[slug]/[itemId]/page.tsx` (adicionar polling + form)
- Create: `src/components/bid-form.tsx` (novo componente client)
- Modify: `src/components/bid-history.tsx` (aceitar `bids` prop atualizado via props)

**Interfaces:**
- `BidForm` client component: `<form action={placeBidAction}>` com input `amount` (number, step 0.01, min calculado)
- Polling: `useEffect` 10s → `getItemBidsAction` → atualiza `BidHistory` + `BidCountdown`

- [ ] **Step 1: Componente `BidForm`**

Criar `src/components/bid-form.tsx`:

```tsx
"use client";
import { useActionState } from "react";
import { placeBidAction } from "@/presentation/actions/bid-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BidFormProps {
  itemId: string;
  minBid: number; // centavos
  onSuccess?: () => void;
}

export function BidForm({ itemId, minBid, onSuccess }: BidFormProps) {
  const [state, formAction, pending] = useActionState(placeBidAction, null as { ok?: boolean; error?: string } | null);
  const minReais = (minBid / 100).toFixed(2);

  return (
    <form action={formAction} className="space-y-3">
      {state && "error" in state && state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-emerald-600">Lance registrado!</p>}
      <div className="space-y-2">
        <Label htmlFor="amount">Seu lance (R$)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min={minReais}
          placeholder={`Mínimo R$ ${minReais}`}
          required
          disabled={pending}
        />
        <input type="hidden" name="itemId" value={itemId} />
      </div>
      <Button type="submit" disabled={pending}>Dar lance</Button>
    </form>
  );
}
```

- [ ] **Step 2: Atualizar página de detalhe**

Em `src/app/(public)/[slug]/[itemId]/page.tsx`:
- Importar `BidForm` e `getItemBidsAction`
- Adicionar estado `bids` + `useEffect` polling 10s
- Passar `bids` para `BidHistory` e `minBid` para `BidForm`
- `minBid` = `bids.length > 0 ? bids[0].amount + item.minBidIncrement : item.minInitialBid`

- [ ] **Step 3: Verificação + commit**

Run: `pnpm test && npx next typegen && npx tsc --noEmit && pnpm lint`

```bash
git add src/components/bid-form.tsx src/app/\(public\)/\[slug\]/\[itemId\]/page.tsx
git commit -m "feat: polling de lances + formulário de lance na página de detalhe"
```

---

### Task 7: Resend Template `outbid` + Integração Email

**Files:**
- Modify: `src/infrastructure/email/resend.ts` (se necessário)
- Create: `src/lib/email-templates.ts` (template `outbid`)

**Interfaces:**
- Função `sendOutbidEmail(to, data)` usando Resend

- [ ] **Step 1: Template e client**

Criar `src/lib/email-templates.ts`:

```ts
export function renderOutbidEmail(data: {
  bidderName: string;
  itemTitle: string;
  oldAmount: number; // centavos
  newAmount: number;
  itemUrl: string;
}): string {
  return `
    <p>Olá ${data.bidderName},</p>
    <p>Seu lance de <strong>R$ ${(data.oldAmount / 100).toFixed(2)}</strong> em <strong>${data.itemTitle}</strong> foi superado por <strong>R$ ${(data.newAmount / 100).toFixed(2)}</strong>.</p>
    <p><a href="${data.itemUrl}" style="color: #3b82f6;">Dar novo lance</a></p>
  `;
}
```

Em `resend.ts`, adicionar `sendOutbidEmail`:

```ts
export async function sendOutbidEmail(resend: Resend, to: string, data: { bidderName: string; itemTitle: string; oldAmount: number; newAmount: number; itemUrl: string }) {
  const html = renderOutbidEmail(data);
  return resend.emails.send({
    from: "Leiloeiro Nerd <noreply@leiloeironerd.com>",
    to,
    subject: "Seu lance foi superado!",
    html,
  });
}
```

- [ ] **Step 2: Integração no `place-bid.ts`**

Já usa `resend.emails.send` inline; refatorar para usar `sendOutbidEmail` se preferir.

- [ ] **Step 3: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint`

```bash
git add src/lib/email-templates.ts src/infrastructure/email/resend.ts
git commit -m "feat: template de email outbid + integração Resend"
```

---

### Task 8: Testes de Integração + Verificação Final

**Files:**
- Test: `src/presentation/actions/bid-actions.test.ts` (mock utapi/resend/drizzle)
- Test: `src/app/(public)/[slug]/[itemId]/page.test.tsx` (render + polling mock)

**Verification:**
- [ ] **Step 1: Suite completa**

Run: `pnpm test` — Expected: PASS (todos os arquivos)

- [ ] **Step 2: Tipos + lint**

Run: `npx next typegen && npx tsc --noEmit && pnpm lint` — Expected: limpio

- [ ] **Step 3: Build**

Run: `pnpm build` — Expected: OK

- [ ] **Step 4: Smoke manual**

Run: `pnpm dev` → login → criar item → publish → acessar `/{slug}/{itemId}` → dar lance → verificar:
  - Lance persistido no DB (`SELECT * FROM bids WHERE item_id = ...`)
  - Notificação in-app criada (`SELECT * FROM notifications WHERE type = 'outbid'`)
  - Email enviado (logs Resend / console dev)
  - Polling atualiza `BidHistory` em 10s
  - Countdown mostra "Encerrado" após deadline
  - Validações bloqueiam lances inválidos

- [ ] **Step 5: Atualizar docs/project.md**

Marcar Fase 2 itens 5-7 como concluídos:

```bash
git add docs/project.md
git commit -m "docs: atualiza roadmap após sub-projeto 2c"
```

---

## Checklist de Cobertura do Spec

| Spec Section | Tasks |
|--------------|-------|
| BidRepository.createBid | Task 1 |
| NotificationRepository | Task 2 |
| place-bid use case | Task 3 |
| get-item-bids use case | Task 4 |
| Server Actions (placeBid + getItemBids) | Task 5 |
| Polling + BidForm na página | Task 6 |
| Resend outbid template | Task 7 |
| Testes + verificação final | Task 8 |

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-18-leiloeiro-nerd-bidding.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**