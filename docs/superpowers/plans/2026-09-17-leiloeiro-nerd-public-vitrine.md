# Sub-projeto 2b: Vitrine Pública + Upload UploadThing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar vitrine pública (`/{slug}`), detalhe do item (`/{slug}/{itemId}`) e upload de múltiplas imagens via UploadThing integrado ao dashboard.

**Architecture:** Clean Architecture — novos use cases públicos, repositórios estendidos, server actions públicas + dashboard, componentes UI reutilizáveis, páginas no grupo `(public)`.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Drizzle ORM, UploadThing, Better Auth, Tailwind + shadcn/ui (base-ui), Vitest.

**Spec:** docs/superpowers/specs/2026-09-17-leiloeiro-nerd-public-vitrine-design.md

## Global Constraints

- Idioma: pt-BR (UI, mensagens, erros)
- TypeScript strict, sem comentários exceto se solicitado
- Valores monetários em centavos (integer)
- `PageProps<Route>` helper global Next 16 para tipar `params`/`searchParams` (Promise)
- `searchParams` = `Promise<{ [key: string]: string \| string[] \| undefined }>` — requer `await`
- shadcn/ui com base-ui usa prop `render` NÃO `asChild`
- UploadThing: max 10 imagens/item, 5MB cada, tipos `image/*`
- TDD obrigatório para use cases e validações
- Commits por task com mensagens convencionais (`feat:`, `fix:`, `docs:`)

---

### Task 1: Schema DB + Migração `item_images`

**Files:**
- Create: `src/infrastructure/database/schema.ts` (modify — add `item_images` table)
- Create: `drizzle/0002_item_images.sql` (migration)

**Interfaces:**
- Produces: tabela `item_images` (id, itemId FK, url, position, createdAt), índice em `itemId`

- [ ] **Step 1: Adicionar tabela `item_images` em `schema.ts`**

```ts
export const itemImages = pgTable("item_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("item_images_item_id_idx").on(t.itemId)]);
```

- [ ] **Step 2: Gerar migração**

Run: `pnpm db:generate` — Expected: cria `drizzle/0002_item_images.sql`
- [ ] **Step 3: Aplicar migração**

Run: `pnpm db:migrate` (ou `pnpm db:push`) — Expected: tabela criada no Postgres
- [ ] **Step 4: Verificação + commit**

Run: `npx tsc --noEmit` — Expected: PASS

```bash
git add src/infrastructure/database/schema.ts drizzle/0002_item_images.sql
git commit -m "feat: schema item_images para galeria de imagens"
```

---

### Task 2: Estender `ItemRepository` com métodos de imagens

**Files:**
- Modify: `src/domain/repositories/item-repository.ts` (add `ItemImage` type + image methods)
- Modify: `src/infrastructure/database/repositories/drizzle-item-repository.ts` (implement image methods)

**Interfaces:**
- Consumes: `ItemImage` type (id, itemId, url, position, createdAt)
- Produces: `findImagesByItemId`, `createImages`, `deleteImage` no `ItemRepository`

- [ ] **Step 1: Adicionar tipos e métodos ao contrato**

Em `item-repository.ts`, adicionar:

```ts
export interface ItemImage {
  id: string;
  itemId: string;
  url: string;
  position: number;
  createdAt: Date;
}

export interface ItemRepository {
  // ...existing...
  findImagesByItemId(itemId: string): Promise<ItemImage[]>;
  createImages(itemId: string, urls: string[]): Promise<ItemImage[]>;
  deleteImage(imageId: string): Promise<void>;
}
```

- [ ] **Step 2: Implementar no repositório Drizzle**

Em `drizzle-item-repository.ts`, adicionar imports e implementação:

```ts
import { itemImages } from "@/infrastructure/database/schema";
// ...
async findImagesByItemId(itemId) {
  const rows = await db.select().from(itemImages).where(eq(itemImages.itemId, itemId)).orderBy(itemImages.position);
  return rows.map(r => ({ id: r.id, itemId: r.itemId, url: r.url, position: r.position, createdAt: r.createdAt }));
},
async createImages(itemId, urls) {
  const values = urls.map((url, i) => ({ itemId, url, position: i }));
  const rows = await db.insert(itemImages).values(values).returning();
  return rows.map(r => ({ id: r.id, itemId: r.itemId, url: r.url, position: r.position, createdAt: r.createdAt }));
},
async deleteImage(imageId) {
  await db.delete(itemImages).where(eq(itemImages.id, imageId));
},
```

- [ ] **Step 3: Verificação + commit**

Run: `npx next typegen && npx tsc --noEmit && pnpm test` — Expected: PASS

```bash
git add src/domain/repositories/item-repository.ts src/infrastructure/database/repositories/drizzle-item-repository.ts
git commit -m "feat: métodos de imagens no ItemRepository"
```

---

### Task 3: `BidRepository` para histórico de lances (read-only)

**Files:**
- Create: `src/domain/repositories/bid-repository.ts`
- Create: `src/infrastructure/database/repositories/drizzle-bid-repository.ts`

**Interfaces:**
- Produces: `BidRepository.findByItemId(itemId) → Promise<Bid[]>`

- [ ] **Step 1: Contrato `BidRepository`**

```ts
export interface Bid {
  id: string;
  itemId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  rank: number | null;
  createdAt: Date;
}

export interface BidRepository {
  findByItemId(itemId: string): Promise<Bid[]>;
}
```

- [ ] **Step 2: Implementação Drizzle**

```ts
export const drizzleBidRepository: BidRepository = {
  async findByItemId(itemId) {
    const rows = await db.select({
      id: bids.id,
      itemId: bids.itemId,
      bidderId: bids.bidderId,
      amount: bids.amount,
      rank: bids.rank,
      createdAt: bids.createdAt,
    }).from(bids).where(eq(bids.itemId, itemId)).orderBy(desc(bids.amount));
    // bidderName via join com user table — simplificado: retorna bidderId, nome resolvido no use case
    return rows.map(r => ({ ...r, bidderName: r.bidderId }));
  },
};
```

- [ ] **Step 3: Verificação + commit**

Run: `npx tsc --noEmit && pnpm test` — Expected: PASS

```bash
git add src/domain/repositories/bid-repository.ts src/infrastructure/database/repositories/drizzle-bid-repository.ts
git commit -m "feat: BidRepository para histórico de lances"
```

---

### Task 4: Use Cases Públicos (TDD)

**Files:**
- Create: `src/application/use-cases/get-seller-by-slug.ts` + `.test.ts`
- Create: `src/application/use-cases/list-active-items-by-seller.ts` + `.test.ts`
- Create: `src/application/use-cases/get-item-by-slug-and-id.ts` + `.test.ts`
- Create: `src/application/use-cases/get-item-bids.ts` + `.test.ts`
- Create: `src/application/use-cases/create-item-images.ts` + `.test.ts`
- Create: `src/application/use-cases/delete-item-image.ts` + `.test.ts`

**Interfaces:**
- Consumes: `UserRepository`, `ItemRepository`, `BidRepository`, `ItemImage`, `Item`, `Bid`
- Produces: 6 use cases públicos

- [ ] **Step 1: `getSellerBySlug` (TDD)**

Test: busca seller por slug, retorna `UserProfile | null`, valida role `seller|both`
Impl: `userRepo.findBySlug(slug)` + filtra role

- [ ] **Step 2: `listActiveItemsBySellerId` (TDD)**

Test: lista apenas `status === "active"`, ordena `createdAt` desc
Impl: `itemRepo.findBySellerId(sellerId, { status: "active" })`

- [ ] **Step 3: `getItemBySlugAndId` (TDD)**

Test: busca item + valida `item.seller.slug === slug` + `status === "active"`, retorna `{ item, images, bids }`
Impl: `itemRepo.findById` → valida seller/slug/status → `itemRepo.findImagesByItemId` + `bidRepo.findByItemId`

- [ ] **Step 4: `getItemBids` (TDD)**

Test: retorna lances ordenados por `amount` desc (maior primeiro), inclui `bidderName` (via `userRepo.findById`)
Impl: `bidRepo.findByItemId` → map com nomes

- [ ] **Step 5: `createItemImages` (TDD)**

Test: persiste array de URLs com positions 0..N, retorna `ItemImage[]`
Impl: `itemRepo.createImages(itemId, urls)`

- [ ] **Step 6: `deleteItemImage` (TDD)**

Test: deleta imagem por ID, valida ownership (item pertence ao seller via `itemRepo.findById`)
Impl: `itemRepo.findImagesByItemId` → valida → `itemRepo.deleteImage`

- [ ] **Step 7: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit` — Expected: 48 + 18 novos = 66 tests PASS

```bash
git add src/application/use-cases/*-seller*.ts src/application/use-cases/*-item-images*.ts src/application/use-cases/*-item-bid*.ts
git commit -m "feat: use cases públicos (vitrine, detalhe, imagens, lances)"
```

---

### Task 5: UploadThing Config + Server Actions Upload/Delete

**Files:**
- Create: `src/infrastructure/upload/uploadthing.ts`
- Create: `src/presentation/actions/upload-actions.ts`
- Modify: `src/lib/validators.ts` (add `imageUploadSchema`)

**Interfaces:**
- Consumes: `UploadThing` FileRouter, `formToObject`
- Produces: `uploadItemImagesAction(formData) → { urls: string[] }`, `deleteItemImageAction(imageId) → void`

- [ ] **Step 1: Config UploadThing**

```ts
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { z } from "zod";

const f = createUploadthing();

export const uploadRouter = {
  itemImages: f({ image: { maxFileSize: "5MB", maxFileCount: 10 } })
    .input(z.object({ itemId: z.string().uuid() }))
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("[UploadThing] upload completo:", file.url);
      return { url: file.url };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
```

- [ ] **Step 2: Route handler Next.js**

Create: `src/app/api/uploadthing/[...uploadthing]/route.ts`

```ts
import { createRouteHandler } from "uploadthing/next";
import { uploadRouter } from "@/infrastructure/upload/uploadthing";

export const { GET, POST } = createRouteHandler({ router: uploadRouter });
```

- [ ] **Step 3: Server Actions upload/delete**

```ts
"use server";
import { getSession } from "./auth-actions";
import { uploadRouter } from "@/infrastructure/upload/uploadthing";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";

export async function uploadItemImagesAction(_prev: { urls?: string[]; error?: string } | null, formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  // UploadThing server-side via createUploadthing().handleUpload
  // Simplificado: usa utapi ou handleUpload direto
}

export async function deleteItemImageAction(_prev: { ok?: boolean; error?: string } | null, formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  // delete via utapi ou action direta
}
```

- [ ] **Step 4: Validação `imageUploadSchema`**

Em `validators.ts`:

```ts
export const imageUploadSchema = z.object({
  images: z.instanceof(FileList).refine(f => f.length <= 10, "Máximo 10 imagens")
    .refine(f => Array.from(f).every(file => file.size <= 5 * 1024 * 1024), "Máx 5MB por imagem")
    .refine(f => Array.from(f).every(file => file.type.startsWith("image/")), "Apenas imagens"),
});
```

- [ ] **Step 5: Verificação + commit**

Run: `npx next typegen && npx tsc --noEmit && pnpm test` — Expected: PASS

```bash
git add src/infrastructure/upload src/app/api/uploadthing src/presentation/actions/upload-actions.ts src/lib/validators.ts
git commit -m "feat: UploadThing config + server actions upload/delete"
```

---

### Task 6: Server Actions Públicas (Vitrine + Detalhe)

**Files:**
- Create: `src/presentation/actions/public-actions.ts`

**Interfaces:**
- Consumes: use cases públicos, `getSession` (opcional, para futuras features)
- Produces: `getSellerVitrineAction(slug) → { seller, items }`, `getItemDetailAction(slug, itemId) → { item, images, bids }`

- [ ] **Step 1: `getSellerVitrineAction`**

```ts
"use server";
import { getSellerBySlug } from "@/application/use-cases/get-seller-by-slug";
import { listActiveItemsBySellerId } from "@/application/use-cases/list-active-items-by-seller-id";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";

export async function getSellerVitrineAction(slug: string) {
  const seller = await getSellerBySlug(drizzleUserRepository, slug);
  if (!seller) return { seller: null, items: [] };
  const items = await listActiveItemsBySellerId(drizzleItemRepository, seller.id);
  return { seller, items };
}
```

- [ ] **Step 2: `getItemDetailAction`**

```ts
export async function getItemDetailAction(slug: string, itemId: string) {
  const result = await getItemBySlugAndId(
    drizzleItemRepository,
    drizzleBidRepository, // precisa importar
    drizzleUserRepository,
    slug, itemId
  );
  if (!result) return { item: null, images: [], bids: [] };
  return { item: result.item, images: result.images, bids: result.bids };
}
```

- [ ] **Step 3: Verificação + commit**

Run: `npx next typegen && npx tsc --noEmit && pnpm test` — Expected: PASS

```bash
git add src/presentation/actions/public-actions.ts
git commit -m "feat: server actions públicas (vitrine + detalhe)"
```

---

### Task 7: Componentes UI Públicos

**Files:**
- Create: `src/components/item-gallery.tsx`
- Create: `src/components/bid-countdown.tsx`
- Create: `src/components/bid-history.tsx`
- Create: `src/components/public-item-card.tsx`

**Interfaces:**
- Consumes: `Item`, `ItemImage`, `Bid`
- Produces: 4 componentes reutilizáveis

- [ ] **Step 1: `ItemGallery`**

Props: `images: string[]` (URLs). Carrossel simples: imagem principal grande + thumbnails clicáveis. `useState` para índice ativo.

- [ ] **Step 2: `BidCountdown`**

Props: `deadline: Date`. `useEffect` + `setInterval` 1s → calcula diff → renderiza "Xd Yh Zm Ss". Quando <= 0, mostra "Encerrado".

- [ ] **Step 3: `BidHistory`**

Props: `bids: Bid[]`. Tabela: Posição (rank), Valor (R$), Arrematante (nome), Data. Se vazio: "Nenhum lance ainda".

- [ ] **Step 4: `PublicItemCard`**

Props: `item: Item, imageUrl?: string`. Card: thumb (imageUrl ou placeholder), título, lance mínimo (R$), link para `/${slug}/${itemId}`.

- [ ] **Step 5: Verificação + commit**

Run: `npx tsc --noEmit && pnpm test` — Expected: PASS

```bash
git add src/components/item-gallery.tsx src/components/bid-countdown.tsx src/components/bid-history.tsx src/components/public-item-card.tsx
git commit -m "feat: componentes UI públicos (gallery, countdown, history, card)"
```

---

### Task 8: Páginas Públicas `(public)`

**Files:**
- Create: `src/app/(public)/layout.tsx`
- Create: `src/app/(public)/[slug]/page.tsx`
- Create: `src/app/(public)/[slug]/[itemId]/page.tsx`

**Interfaces:**
- Consumes: `getSellerVitrineAction`, `getItemDetailAction`, componentes UI
- Produces: 3 rotas renderizadas

- [ ] **Step 1: Layout público**

```tsx
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background font-sans antialiased">
        <header className="border-b px-4 py-3">
          <a href="/" className="text-xl font-bold">Leiloeiro Nerd</a>
        </header>
        <main className="container mx-auto py-8 px-4">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Vitrine `/{slug}`**

```tsx
export const dynamic = "force-dynamic";
export default async function VitrinePage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const { seller, items } = await getSellerVitrineAction(slug);
  if (!seller) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Vitrine de {seller.name}</h1>
      {items.length === 0 ? <p>Nenhum item em leilão.</p> : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(item => <PublicItemCard key={item.id} item={item} imageUrl={item.imageUrl} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Detalhe `/{slug}/{itemId}`**

```tsx
export const dynamic = "force-dynamic";
export default async function ItemDetailPage({ params }: PageProps<"/[slug]/[itemId]">) {
  const { slug, itemId } = await params;
  const { item, images, bids } = await getItemDetailAction(slug, itemId);
  if (!item) notFound();
  return (
    <div className="space-y-6 max-w-3xl">
      <ItemGallery images={images.length ? images : (item.imageUrl ? [item.imageUrl] : [])} />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{item.title}</h1>
        <p className="text-muted-foreground">{item.description}</p>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>Lance mínimo: R$ {(item.minInitialBid / 100).toFixed(2)}</span>
          <BidCountdown deadline={item.bidDeadline} />
        </div>
      </div>
      <BidHistory bids={bids} />
      <a href={`/dashboard/items/${item.id}/edit`} className="text-primary underline hidden">Editar (owner only)</a>
    </div>
  );
}
```

- [ ] **Step 4: Verificação + commit**

Run: `npx next typegen && npx tsc --noEmit && pnpm lint && pnpm test` — Expected: PASS

```bash
git add src/app/\(public\)
git commit -m "feat: páginas públicas (vitrine + detalhe do item)"
```

---

### Task 9: Integração Upload no Dashboard (`ItemForm` + `itemSchema`)

**Files:**
- Modify: `src/lib/validators.ts` (add `imageUrls` to `itemSchema`)
- Modify: `src/components/item-form.tsx` (dropzone + upload + preview)
- Modify: `src/application/use-cases/create-item.ts` + `update-item.ts` (accept `imageUrls`)
- Modify: `src/presentation/actions/item-actions.ts` (pass `imageUrls` to use case)

**Interfaces:**
- `itemSchema` gains `imageUrls: z.array(z.string().url()).max(10).optional()`
- `CreateItemInput`/`UpdateItemInput` gain `imageUrls?: string[]`
- Use cases call `createItemImages` after create/update

- [ ] **Step 1: Validators — add `imageUrls`**

```ts
imageUrls: z.array(z.string().url()).max(10).optional(),
```

- [ ] **Step 2: `ItemForm` — dropzone + upload**

- Adicionar `<input type="file" multiple accept="image/*" onChange={handleFiles} />`
- `handleFiles`: valida `imageUploadSchema`, chama `uploadItemImagesAction`, seta `urls` no state, mostra preview
- No submit: inclui `imageUrls` no FormData (hidden inputs ou `formData.append`)

- [ ] **Step 3: Use cases — accept `imageUrls`**

Em `create-item.ts`: após `itemRepo.create`, se `input.imageUrls?.length` chama `createItemImages(item.id, input.imageUrls)`
Em `update-item.ts`: similar, substitui imagens existentes (delete old + create new) ou adiciona

- [ ] **Step 4: Actions — pass `imageUrls`**

Em `item-actions.ts`: extrai `imageUrls` do FormData (hidden inputs) e passa para use case

- [ ] **Step 5: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint` — Expected: PASS

```bash
git add src/lib/validators.ts src/components/item-form.tsx src/application/use-cases/create-item.ts src/application/use-cases/update-item.ts src/presentation/actions/item-actions.ts
git commit -m "feat: integração upload imagens no ItemForm + use cases"
```

---

### Task 10: Testes de Integração + Verificação Final

**Files:**
- Test: `src/presentation/actions/public-actions.test.ts`
- Test: `src/presentation/actions/upload-actions.test.ts`
- Test: `src/app/(public)/[slug]/page.test.tsx` (render + searchParams)
- Test: `src/app/(public)/[slug]/[itemId]/page.test.tsx`

**Verification:**
- [ ] **Step 1: Suite completa**

Run: `pnpm test` — Expected: todos os testes passam (incluindo novos)
- [ ] **Step 2: Tipos + lint**

Run: `npx next typegen && npx tsc --noEmit && pnpm lint` — Expected: PASS
- [ ] **Step 3: Build**

Run: `pnpm build` — Expected: OK
- [ ] **Step 4: Smoke manual**

Run: `pnpm dev` → acessar `/login` → criar conta → settings → become-seller → dashboard/items/new → upload imagens → publish → acessar `/{slug}` → verificar vitrine → acessar `/{slug}/{itemId}` → verificar galeria + countdown + histórico

- [ ] **Step 5: Atualizar docs/project.md**

Marcar itens 2b como concluídos no roadmap:
- [x] Upload de imagens (UploadThing)
- [x] Página de vitrine do leiloeiro (`/{slug}`)
- [x] Página de detalhe do item (`/{slug}/{itemId}`)

```bash
git add docs/project.md
git commit -m "docs: atualiza roadmap após sub-projeto 2b"
```

---

## Checklist de Cobertura do Spec

| Spec Section | Tasks |
|--------------|-------|
| Schema DB `item_images` | Task 1 |
| `ItemRepository` images | Task 2 |
| `BidRepository` | Task 3 |
| Use Cases (6) | Task 4 |
| UploadThing config + actions | Task 5 |
| Server Actions públicas | Task 6 |
| Componentes UI (4) | Task 7 |
| Páginas `(public)` (3) | Task 8 |
| Integração `ItemForm` + schema | Task 9 |
| Testes + verificação final | Task 10 |

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-17-leiloeiro-nerd-public-vitrine.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**