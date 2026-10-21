# Sub-projeto 2a — CRUD de Itens e Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar CRUD de itens para leiloeiros e dashboard de gerenciamento, com upgrade de role self-service.

**Architecture:** Clean Architecture pragmática já estabelecida — use cases puros com repositórios injetados (padrão de `update-profile`), server actions finas como orquestradoras, UI com shadcn/ui e `useActionState`. Autorização por role em defesa em profundidade (use case + UI).

**Tech Stack:** Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind v4 + shadcn/ui (base-ui), Drizzle ORM + PostgreSQL, zod, Better Auth, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-17-leiloeiro-nerd-items-design.md`

## Global Constraints

- UI e mensagens de erro em pt-BR.
- Valores monetários sempre `integer` (centavos), ≥ 100 (R$ 1,00).
- Código sem comentários (repo usa `//` apenas em casos excepcionais documentados).
- Retorno de server actions: `ActionResult = { ok?: boolean; error?: string }` (pt-BR).
- Repositórios implementam interfaces em `src/domain/repositories/`; use cases não importam infra.
- Tests: Vitest, `include: ["src/**/*.test.ts"]`, alias `@` → `src`.
- Project-wide: pastas `(dashboard)` já protegidas por proxy; rotas de dashboard já existentes: `layout.tsx`, `page.tsx`, `settings/{page,settings-form}.tsx`.
- Não editar `auth-schema.ts` manualmente além do já feito (role enum). Qualquer nova coluna de user via `UserRepository`, sem migration nova neste sub-projeto (schema `items` já existe).

---

## Estrutura de arquivos

Arquivos novos:

- `src/domain/repositories/item-repository.ts` — tipos `Item`, `ItemType`, `ItemStatus`, `CreateItemInput`, `UpdateItemInput`, `ItemListFilter` e interface `ItemRepository`.
- `src/infrastructure/database/repositories/drizzle-item-repository.ts` — implementação Drizzle.
- `src/application/use-cases/create-item.ts`, `update-item.ts`, `publish-item.ts`, `cancel-item.ts`, `delete-item.ts`, `list-seller-items.ts`, `become-seller.ts`.
- `src/application/use-cases/*.test.ts` — testes de cada use case.
- `src/presentation/actions/item-actions.ts`.
- `src/components/item-form.tsx`, `item-status-badge.tsx`, `become-seller-form.tsx`.
- `src/app/(dashboard)/dashboard/items/page.tsx`, `items-list.tsx`, `items/new/page.tsx`, `items/[id]/edit/page.tsx`.

Arquivos modificados:

- `src/domain/repositories/user-repository.ts` — adicionar `findById` e `updateRole`.
- `src/infrastructure/database/repositories/drizzle-user-repository.ts` — implementar `findById` e `updateRole`.
- `src/application/use-cases/update-profile.test.ts` — o fake de `UserRepository` passa a implementar os métodos novos.
- `src/lib/validators.ts` — adicionar `itemSchema` e `becomeSellerSchema`.
- `src/presentation/actions/profile-actions.ts` — adicionar `becomeSellerAction`.
- `src/app/(dashboard)/dashboard/settings/page.tsx` — renderizar `BecomeSellerForm` quando role não é seller.
- `src/lib/constants.ts` — adicionar constantes de status/type (opcional, usado pela badge).

---

### Task 1: Contrato `ItemRepository` + tipos

**Files:**
- Create: `src/domain/repositories/item-repository.ts`

**Interfaces:**
- Produces: tipos `ItemType`, `ItemStatus`, `Item`, `CreateItemInput`, `UpdateItemInput`, `ItemListFilter`, interface `ItemRepository`.

- [ ] **Step 1: Escrever o contrato**

```ts
export type ItemType = "product" | "service" | "piece";
export type ItemStatus = "draft" | "active" | "closed" | "awaiting_payment" | "paid" | "cancelled";

export interface Item {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  type: ItemType;
  imageUrl: string | null;
  minInitialBid: number;
  minBidIncrement: number;
  bidDeadline: Date;
  paymentDeadlineDays: number;
  status: ItemStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateItemInput {
  sellerId: string;
  title: string;
  description: string;
  type: ItemType;
  minInitialBid: number;
  minBidIncrement: number;
  bidDeadline: Date;
  paymentDeadlineDays?: number;
}

export interface UpdateItemInput {
  title?: string;
  description?: string;
  type?: ItemType;
  minInitialBid?: number;
  minBidIncrement?: number;
  bidDeadline?: Date;
  paymentDeadlineDays?: number;
}

export interface ItemListFilter {
  status?: ItemStatus;
}

export interface ItemRepository {
  create(input: CreateItemInput): Promise<Item>;
  update(id: string, input: UpdateItemInput): Promise<Item | null>;
  findById(id: string): Promise<Item | null>;
  findBySellerId(sellerId: string, filter?: ItemListFilter): Promise<Item[]>;
  delete(id: string): Promise<void>;
  setStatus(id: string, status: ItemStatus): Promise<Item | null>;
  countBids(itemId: string): Promise<number>;
}
```

- [ ] **Step 2: Verificação de tipos**

Run: `npx tsc --noEmit` — Expected: PASS (arquivo novo não usado, sem erro).
- [ ] **Step 3: Commit**

```bash
git add src/domain/repositories/item-repository.ts
git commit -m "feat: contrato ItemRepository e tipos de item"
```

---

### Task 2: Estender `UserRepository` (`findById`, `updateRole`)

**Files:**
- Modify: `src/domain/repositories/user-repository.ts`
- Modify: `src/infrastructure/database/repositories/drizzle-user-repository.ts`
- Modify: `src/application/use-cases/update-profile.test.ts`

**Interfaces:**
- Consumes: `UserProfile`, `UserRole` (existentes).
- Produces: `UserRepository.findById(userId) → Promise<UserProfile | null>`, `UserRepository.updateRole(userId, role, slug) → Promise<UserProfile>`.

- [ ] **Step 1: Adicionar métodos ao contrato**

Em `src/domain/repositories/user-repository.ts`, adicionar ao `UserRepository`:

```ts
  findById(userId: string): Promise<UserProfile | null>;
  updateRole(userId: string, role: UserRole, slug: string): Promise<UserProfile>;
```

- [ ] **Step 2: Implementar no repositório Drizzle**

Em `src/infrastructure/database/repositories/drizzle-user-repository.ts`, adicionar:

```ts
  async findById(userId) {
    const [row] = await db
      .select({ id: userTable.id, name: userTable.name, email: userTable.email, phone: userTable.phone, slug: userTable.slug, address: userTable.address, role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    if (!row) return null;
    return { ...row, role: row.role as UserProfile["role"] };
  },

  async updateRole(userId, role, slug) {
    const [row] = await db
      .update(userTable)
      .set({ role, slug })
      .where(eq(userTable.id, userId))
      .returning({ id: userTable.id, name: userTable.name, email: userTable.email, phone: userTable.phone, slug: userTable.slug, address: userTable.address, role: userTable.role });
    if (!row) throw new Error("Usuário não encontrado");
    return { ...row, role: row.role as UserProfile["role"] };
  },
```

- [ ] **Step 3: Atualizar o fake do teste de update-profile**

Em `src/application/use-cases/update-profile.test.ts`, o `FakeUserRepository` deve implementar os novos métodos (senão `tsc` quebra):

```ts
  async findById() {
    return baseUser;
  }
  async updateRole() {
    return baseUser;
  }
```

- [ ] **Step 4: Verificação**

Run: `npx tsc --noEmit` e `pnpm test` — Expected: PASS (3 files, 13 tests).
- [ ] **Step 5: Commit**

```bash
git add src/domain/repositories/user-repository.ts src/infrastructure/database/repositories/drizzle-user-repository.ts src/application/use-cases/update-profile.test.ts
git commit -m "feat: findById e updateRole no UserRepository"
```

---

### Task 3: Use case `create-item` (TDD)

**Files:**
- Test: `src/application/use-cases/create-item.test.ts`
- Create: `src/application/use-cases/create-item.ts`

**Interfaces:**
- Consumes: `ItemRepository`, `UserRepository`, `CreateItemInput` (Omit `sellerId`), `Item`, `UserProfile`.
- Produces: `createItem(itemRepo, userRepo, userId, input) → Promise<Item>`.
- Erros (mensagens domínio): `"Apenas leiloeiros podem criar itens"`, `"Prazo de lances deve ser no futuro"`, `"Lance mínimo deve ser de pelo menos R$ 1,00"`.

- [ ] **Step 1: Escrever o teste**

`src/application/use-cases/create-item.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createItem } from "./create-item";
import type { CreateItemInput, Item, ItemRepository } from "@/domain/repositories/item-repository";
import type { UserProfile, UserRepository } from "@/domain/repositories/user-repository";

const baseUser: UserProfile = {
  id: "u1",
  name: "Ana",
  email: "ana@ex.com",
  phone: null,
  slug: null,
  address: null,
  role: "seller",
};

class FakeUserRepository implements UserRepository {
  constructor(private user: UserProfile | null) {}
  async findById() {
    return this.user;
  }
  async updateProfile(_: string, input: Record<string, unknown>) {
    return { ...this.user!, ...input } as UserProfile;
  }
  async findBySlug() {
    return null;
  }
  async updateRole() {
    return this.user!;
  }
}

class FakeItemRepository implements ItemRepository {
  captures: (Omit<CreateItemInput, "sellerId"> & { sellerId: string })[] = [];
  async create(input: CreateItemInput) {
    this.captures.push(input);
    return {
      id: "i1",
      ...input,
      imageUrl: null,
      paymentDeadlineDays: input.paymentDeadlineDays ?? 3,
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Item;
  }
  async update() {
    return null;
  }
  async findById() {
    return null;
  }
  async findBySellerId() {
    return [];
  }
  async delete() {}
  async setStatus() {
    return null;
  }
  async countBids() {
    return 0;
  }
}

const valid = {
  title: "Action Figure rara",
  description: "Colecionável lacrado, edição limitada.",
  type: "product" as const,
  minInitialBid: 5000,
  minBidIncrement: 500,
  bidDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
};

describe("createItem", () => {
  it("cria item como seller", async () => {
    const userRepo = new FakeUserRepository(baseUser);
    const itemRepo = new FakeItemRepository();
    const item = await createItem(itemRepo, userRepo, baseUser.id, valid);
    expect(item.status).toBe("draft");
    expect(itemRepo.captures[0]?.sellerId).toBe("u1");
  });

  it("aceita usuário com role both", async () => {
    const userRepo = new FakeUserRepository({ ...baseUser, role: "both" });
    const itemRepo = new FakeItemRepository();
    await expect(createItem(itemRepo, userRepo, "u1", valid)).resolves.toBeDefined();
  });

  it("rejeita usuário bidder", async () => {
    const userRepo = new FakeUserRepository({ ...baseUser, role: "bidder" });
    const itemRepo = new FakeItemRepository();
    await expect(createItem(itemRepo, userRepo, "u1", valid)).rejects.toThrow("Apenas leiloeiros podem criar itens");
    expect(itemRepo.captures).toHaveLength(0);
  });

  it("rejeita usuário inexistente", async () => {
    const userRepo = new FakeUserRepository(null);
    const itemRepo = new FakeItemRepository();
    await expect(createItem(itemRepo, userRepo, "u1", valid)).rejects.toThrow("Apenas leiloeiros podem criar itens");
  });

  it("rejeita deadline no passado", async () => {
    const itemRepo = new FakeItemRepository();
    await expect(
      createItem(itemRepo, new FakeUserRepository(baseUser), "u1", {
        ...valid,
        bidDeadline: new Date(Date.now() - 1000),
      }),
    ).rejects.toThrow("Prazo de lances deve ser no futuro");
  });

  it("rejeita valores abaixo de R$ 1,00", async () => {
    const itemRepo = new FakeItemRepository();
    await expect(
      createItem(itemRepo, new FakeUserRepository(baseUser), "u1", { ...valid, minInitialBid: 50 }),
    ).rejects.toThrow("Lance mínimo deve ser de pelo menos R$ 1,00");
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `pnpm test -- run src/application/use-cases/create-item.test.ts`
Expected: FAIL — `create-item` module não existe.

- [ ] **Step 3: Implementar**

`src/application/use-cases/create-item.ts`:

```ts
import type { CreateItemInput, Item, ItemRepository } from "@/domain/repositories/item-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";

const SELLER_ROLES = new Set(["seller", "both"]);

export async function createItem(
  itemRepo: ItemRepository,
  userRepo: UserRepository,
  userId: string,
  input: Omit<CreateItemInput, "sellerId">,
): Promise<Item> {
  const user = await userRepo.findById(userId);
  if (!user || !SELLER_ROLES.has(user.role)) {
    throw new Error("Apenas leiloeiros podem criar itens");
  }
  if (input.bidDeadline.getTime() <= Date.now()) {
    throw new Error("Prazo de lances deve ser no futuro");
  }
  if (input.minInitialBid < 100 || input.minBidIncrement < 100) {
    throw new Error("Lance mínimo deve ser de pelo menos R$ 1,00");
  }
  return itemRepo.create({ ...input, sellerId: userId });
}
```

- [ ] **Step 4: Rodar teste para ver passar**

Run: `pnpm test -- run src/application/use-cases/create-item.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Verificação geral + commit**

Run: `pnpm test` e `npx tsc --noEmit` — Expected: PASS.

```bash
git add src/application/use-cases/create-item.ts src/application/use-cases/create-item.test.ts
git commit -m "feat: use case create-item com validação de seller e regras de lance"
```

---

### Task 4: Use case `update-item` (TDD)

**Files:**
- Test: `src/application/use-cases/update-item.test.ts`
- Create: `src/application/use-cases/update-item.ts`

**Interfaces:**
- Consumes: `ItemRepository`, `UpdateItemInput`, `Item`.
- Produces: `updateItem(itemRepo, userId, itemId, input) → Promise<Item>`.
- Erros: `"Item não encontrado"`, `"Sem permissão"`, `"Item publicado não pode ser editado"`, `"Item com lances não pode ser editado"`.

- [ ] **Step 1: Escrever o teste**

`src/application/use-cases/update-item.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { updateItem } from "./update-item";
import type { Item, ItemRepository } from "@/domain/repositories/item-repository";

const baseItem: Item = {
  id: "i1",
  sellerId: "u1",
  title: "Action Figure rara",
  description: "Colecionável lacrado, edição limitada.",
  type: "product",
  imageUrl: null,
  minInitialBid: 5000,
  minBidIncrement: 500,
  bidDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  paymentDeadlineDays: 3,
  status: "draft",
  createdAt: new Date(),
  updatedAt: new Date(),
};

class FakeItemRepository implements ItemRepository {
  constructor(private item: Item | null, private bidCount = 0) {}
  async create() {
    return baseItem;
  }
  async update(_: string, input: Partial<Item>) {
    if (!this.item) return null;
    this.item = { ...this.item, ...input };
    return this.item;
  }
  async findById() {
    return this.item;
  }
  async findBySellerId() {
    return [];
  }
  async delete() {}
  async setStatus() {
    return this.item;
  }
  async countBids() {
    return this.bidCount;
  }
}

describe("updateItem", () => {
  it("permite atualizar item em draft", async () => {
    const repo = new FakeItemRepository(baseItem);
    const result = await updateItem(repo, "u1", "i1", { title: "Novo título" });
    expect(result.title).toBe("Novo título");
  });

  it("bloqueia edição de item publicado", async () => {
    const repo = new FakeItemRepository({ ...baseItem, status: "active" });
    await expect(updateItem(repo, "u1", "i1", { title: "X" })).rejects.toThrow("Item publicado não pode ser editado");
  });

  it("bloqueia edição quando há lances", async () => {
    const repo = new FakeItemRepository(baseItem, 1);
    await expect(updateItem(repo, "u1", "i1", { title: "X" })).rejects.toThrow("Item com lances não pode ser editado");
  });

  it("lança erro se item não existe", async () => {
    const repo = new FakeItemRepository(null);
    await expect(updateItem(repo, "u1", "missing", { title: "X" })).rejects.toThrow("Item não encontrado");
  });

  it("lança erro sem permissão", async () => {
    const repo = new FakeItemRepository(baseItem);
    await expect(updateItem(repo, "u2", "i1", { title: "X" })).rejects.toThrow("Sem permissão");
  });
});
```

- [ ] **Step 2: Rodar teste para ver falhar**

Run: `pnpm test -- run src/application/use-cases/update-item.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/application/use-cases/update-item.ts`:

```ts
import type { Item, ItemRepository, UpdateItemInput } from "@/domain/repositories/item-repository";

export async function updateItem(
  itemRepo: ItemRepository,
  userId: string,
  itemId: string,
  input: UpdateItemInput,
): Promise<Item> {
  const existing = await itemRepo.findById(itemId);
  if (!existing) throw new Error("Item não encontrado");
  if (existing.sellerId !== userId) throw new Error("Sem permissão");
  if (existing.status !== "draft") throw new Error("Item publicado não pode ser editado");
  const bids = await itemRepo.countBids(itemId);
  if (bids > 0) throw new Error("Item com lances não pode ser editado");
  const result = await itemRepo.update(itemId, input);
  if (!result) throw new Error("Item não encontrado");
  return result;
}
```

- [ ] **Step 4: Rodar teste para ver passar**

Run: `pnpm test -- run src/application/use-cases/update-item.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verificação + commit**

Run: `pnpm test`, `npx tsc --noEmit` — Expected: PASS.

```bash
git add src/application/use-cases/update-item.ts src/application/use-cases/update-item.test.ts
git commit -m "feat: use case update-item com bloqueio de edição pós-publicação"
```

---

### Task 5: Use cases `publish-item` e `cancel-item` (TDD)

**Files:**
- Test: `src/application/use-cases/publish-item.test.ts`
- Create: `src/application/use-cases/publish-item.ts`
- Test: `src/application/use-cases/cancel-item.test.ts`
- Create: `src/application/use-cases/cancel-item.ts`

**Interfaces:**
- Produces: `publishItem(itemRepo, userId, itemId) → Promise<Item>`, `cancelItem(itemRepo, userId, itemId) → Promise<Item>`.
- Erros publish: `"Item não encontrado"`, `"Sem permissão"`, `"Item já publicado"`.

- [ ] **Step 1: Teste do publish**

`src/application/use-cases/publish-item.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { publishItem } from "./publish-item";
import type { Item, ItemRepository } from "@/domain/repositories/item-repository";

const baseItem: Item = {
  id: "i1",
  sellerId: "u1",
  title: "Action Figure rara",
  description: "Colecionável lacrado, edição limitada.",
  type: "product",
  imageUrl: null,
  minInitialBid: 5000,
  minBidIncrement: 500,
  bidDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  paymentDeadlineDays: 3,
  status: "draft",
  createdAt: new Date(),
  updatedAt: new Date(),
};

class FakeItemRepository implements ItemRepository {
  constructor(private item: Item | null, private statuses: Item["status"][] = []) {}
  async create() {
    return baseItem;
  }
  async update() {
    return this.item;
  }
  async findById() {
    return this.item;
  }
  async findBySellerId() {
    return [];
  }
  async delete() {}
  async setStatus(_: string, status: Item["status"]) {
    if (!this.item) return null;
    this.statuses.push(status);
    return { ...this.item, status };
  }
  async countBids() {
    return 0;
  }
}

describe("publishItem", () => {
  it("transiciona draft para active", async () => {
    const repo = new FakeItemRepository(baseItem);
    const result = await publishItem(repo, "u1", "i1");
    expect(result.status).toBe("active");
    expect(repo.statuses).toEqual(["active"]);
  });

  it("rejeita item já publicado", async () => {
    const repo = new FakeItemRepository({ ...baseItem, status: "active" });
    await expect(publishItem(repo, "u1", "i1")).rejects.toThrow("Item já publicado");
  });

  it("rejeita item inexistente", async () => {
    const repo = new FakeItemRepository(null);
    await expect(publishItem(repo, "u1", "missing")).rejects.toThrow("Item não encontrado");
  });

  it("rejeita sem permissão", async () => {
    const repo = new FakeItemRepository(baseItem);
    await expect(publishItem(repo, "u2", "i1")).rejects.toThrow("Sem permissão");
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `pnpm test -- run src/application/use-cases/publish-item.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `publish-item.ts`**

```ts
import type { Item, ItemRepository } from "@/domain/repositories/item-repository";

export async function publishItem(
  itemRepo: ItemRepository,
  userId: string,
  itemId: string,
): Promise<Item> {
  const existing = await itemRepo.findById(itemId);
  if (!existing) throw new Error("Item não encontrado");
  if (existing.sellerId !== userId) throw new Error("Sem permissão");
  if (existing.status !== "draft") throw new Error("Item já publicado");
  const result = await itemRepo.setStatus(itemId, "active");
  if (!result) throw new Error("Item não encontrado");
  return result;
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `pnpm test -- run src/application/use-cases/publish-item.test.ts`
Expected: PASS (4 tests).
- [ ] **Step 5: Commit do publish**

```bash
git add src/application/use-cases/publish-item.ts src/application/use-cases/publish-item.test.ts
git commit -m "feat: use case publish-item (draft para active)"
```

- [ ] **Step 6: Teste do cancel**

`src/application/use-cases/cancel-item.test.ts` (fake idêntico ao acima):

```ts
import { describe, expect, it } from "vitest";
import { cancelItem } from "./cancel-item";
import type { Item, ItemRepository } from "@/domain/repositories/item-repository";

const baseItem: Item = {
  id: "i1",
  sellerId: "u1",
  title: "Action Figure rara",
  description: "Colecionável lacrado, edição limitada.",
  type: "product",
  imageUrl: null,
  minInitialBid: 5000,
  minBidIncrement: 500,
  bidDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  paymentDeadlineDays: 3,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

class FakeItemRepository implements ItemRepository {
  constructor(private item: Item | null) {}
  async create() {
    return baseItem;
  }
  async update() {
    return this.item;
  }
  async findById() {
    return this.item;
  }
  async findBySellerId() {
    return [];
  }
  async delete() {}
  async setStatus(_: string, status: Item["status"]) {
    if (!this.item) return null;
    return { ...this.item, status };
  }
  async countBids() {
    return 0;
  }
}

describe("cancelItem", () => {
  it("cancela item active", async () => {
    const repo = new FakeItemRepository(baseItem);
    const result = await cancelItem(repo, "u1", "i1");
    expect(result.status).toBe("cancelled");
  });

  it("cancela item closed", async () => {
    const repo = new FakeItemRepository({ ...baseItem, status: "closed" });
    const result = await cancelItem(repo, "u1", "i1");
    expect(result.status).toBe("cancelled");
  });

  it("rejeita cancelar item em draft", async () => {
    const repo = new FakeItemRepository({ ...baseItem, status: "draft" });
    await expect(cancelItem(repo, "u1", "i1")).rejects.toThrow();
  });

  it("rejeita item inexistente", async () => {
    const repo = new FakeItemRepository(null);
    await expect(cancelItem(repo, "u1", "missing")).rejects.toThrow("Item não encontrado");
  });
});
```

- [ ] **Step 7: Rodar para ver falhar**

Run: `pnpm test -- run src/application/use-cases/cancel-item.test.ts`
Expected: FAIL.

- [ ] **Step 8: Implementar `cancel-item.ts`**

```ts
import type { Item, ItemRepository } from "@/domain/repositories/item-repository";

const CANCELABLE = new Set(["active", "closed"]);

export async function cancelItem(
  itemRepo: ItemRepository,
  userId: string,
  itemId: string,
): Promise<Item> {
  const existing = await itemRepo.findById(itemId);
  if (!existing) throw new Error("Item não encontrado");
  if (existing.sellerId !== userId) throw new Error("Sem permissão");
  if (!CANCELABLE.has(existing.status)) throw new Error("Item não pode ser cancelado neste status");
  const result = await itemRepo.setStatus(itemId, "cancelled");
  if (!result) throw new Error("Item não encontrado");
  return result;
}
```

- [ ] **Step 9: Rodar para ver passar**

Run: `pnpm test -- run src/application/use-cases/cancel-item.test.ts`
Expected: PASS (4 tests).
- [ ] **Step 10: Verificação + commit**

Run: `pnpm test`, `npx tsc --noEmit` — Expected: PASS.

```bash
git add src/application/use-cases/cancel-item.ts src/application/use-cases/cancel-item.test.ts
git commit -m "feat: use case cancel-item (active/closed para cancelled)"
```

---

### Task 6: Use case `delete-item` e `list-seller-items` (TDD)

**Files:**
- Test: `src/application/use-cases/delete-item.test.ts`
- Create: `src/application/use-cases/delete-item.ts`
- Test: `src/application/use-cases/list-seller-items.test.ts`
- Create: `src/application/use-cases/list-seller-items.ts`

**Interfaces:**
- Produces: `deleteItem(itemRepo, userId, itemId) → Promise<void>`, `listSellerItems(itemRepo, sellerId, filter?) → Promise<Item[]>`.
- Erros delete: `"Item não encontrado"`, `"Sem permissão"`, `"Apenas itens em rascunho podem ser excluídos"`, `"Item com lances não pode ser excluído"`.

- [ ] **Step 1: Teste do delete**

`src/application/use-cases/delete-item.test.ts` (reutiliza o mesmo fake de item dos tasks anteriores):

```ts
import { describe, expect, it } from "vitest";
import { deleteItem } from "./delete-item";
import type { Item, ItemRepository } from "@/domain/repositories/item-repository";

const baseItem: Item = {
  id: "i1",
  sellerId: "u1",
  title: "Action Figure rara",
  description: "Colecionável lacrado, edição limitada.",
  type: "product",
  imageUrl: null,
  minInitialBid: 5000,
  minBidIncrement: 500,
  bidDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  paymentDeadlineDays: 3,
  status: "draft",
  createdAt: new Date(),
  updatedAt: new Date(),
};

class FakeItemRepository implements ItemRepository {
  constructor(private item: Item | null, private bidCount = 0, public deleted: string[] = []) {}
  async create() {
    return baseItem;
  }
  async update() {
    return this.item;
  }
  async findById() {
    return this.item;
  }
  async findBySellerId() {
    return [];
  }
  async delete(id: string) {
    this.deleted.push(id);
  }
  async setStatus() {
    return this.item;
  }
  async countBids() {
    return this.bidCount;
  }
}

describe("deleteItem", () => {
  it("deleta item em draft sem lances", async () => {
    const repo = new FakeItemRepository(baseItem);
    await deleteItem(repo, "u1", "i1");
    expect(repo.deleted).toEqual(["i1"]);
  });

  it("rejeita item publicado", async () => {
    const repo = new FakeItemRepository({ ...baseItem, status: "active" });
    await expect(deleteItem(repo, "u1", "i1")).rejects.toThrow("Apenas itens em rascunho podem ser excluídos");
    expect(repo.deleted).toEqual([]);
  });

  it("rejeita item com lances", async () => {
    const repo = new FakeItemRepository(baseItem, 1);
    await expect(deleteItem(repo, "u1", "i1")).rejects.toThrow("Item com lances não pode ser excluído");
    expect(repo.deleted).toEqual([]);
  });

  it("rejeita item inexistente", async () => {
    const repo = new FakeItemRepository(null);
    await expect(deleteItem(repo, "u1", "missing")).rejects.toThrow("Item não encontrado");
  });

  it("rejeita sem permissão", async () => {
    const repo = new FakeItemRepository(baseItem);
    await expect(deleteItem(repo, "u2", "i1")).rejects.toThrow("Sem permissão");
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `pnpm test -- run src/application/use-cases/delete-item.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `delete-item.ts`**

```ts
import type { ItemRepository } from "@/domain/repositories/item-repository";

export async function deleteItem(
  itemRepo: ItemRepository,
  userId: string,
  itemId: string,
): Promise<void> {
  const existing = await itemRepo.findById(itemId);
  if (!existing) throw new Error("Item não encontrado");
  if (existing.sellerId !== userId) throw new Error("Sem permissão");
  if (existing.status !== "draft") throw new Error("Apenas itens em rascunho podem ser excluídos");
  const bids = await itemRepo.countBids(itemId);
  if (bids > 0) throw new Error("Item com lances não pode ser excluído");
  await itemRepo.delete(itemId);
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `pnpm test -- run src/application/use-cases/delete-item.test.ts`
Expected: PASS (5 tests).
- [ ] **Step 5: Teste do list**

`src/application/use-cases/list-seller-items.test.ts` (mesmo fake; `findBySellerId` filtra):

```ts
import { describe, expect, it } from "vitest";
import { listSellerItems } from "./list-seller-items";
import type { Item, ItemRepository } from "@/domain/repositories/item-repository";

const items: Item[] = [
  { id: "i1", sellerId: "u1", title: "A", description: "a", type: "product", imageUrl: null, minInitialBid: 100, minBidIncrement: 100, bidDeadline: new Date(), paymentDeadlineDays: 3, status: "draft", createdAt: new Date(), updatedAt: new Date() },
  { id: "i2", sellerId: "u1", title: "B", description: "b", type: "service", imageUrl: null, minInitialBid: 100, minBidIncrement: 100, bidDeadline: new Date(), paymentDeadlineDays: 3, status: "active", createdAt: new Date(), updatedAt: new Date() },
];

class FakeItemRepository implements ItemRepository {
  constructor(private filter?: { status?: Item["status"] }) {}
  capturedFilter?: { status?: Item["status"] };
  async create() {
    return items[0]!;
  }
  async update() {
    return items[0]!;
  }
  async findById() {
    return items[0]!;
  }
  async findBySellerId(_: string, filter?: { status?: Item["status"] }) {
    this.capturedFilter = filter;
    return filter?.status ? items.filter((i) => i.status === filter.status) : items;
  }
  async delete() {}
  async setStatus() {
    return items[0]!;
  }
  async countBids() {
    return 0;
  }
}

describe("listSellerItems", () => {
  it("lista todos os itens do seller sem filtro", async () => {
    const repo = new FakeItemRepository();
    const result = await listSellerItems(repo, "u1");
    expect(result).toHaveLength(2);
  });

  it("filtra por status quando informado", async () => {
    const repo = new FakeItemRepository();
    const result = await listSellerItems(repo, "u1", { status: "active" });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("i2");
    expect(repo.capturedFilter).toEqual({ status: "active" });
  });
});
```

- [ ] **Step 6: Rodar para ver falhar**

Run: `pnpm test -- run src/application/use-cases/list-seller-items.test.ts`
Expected: FAIL.

- [ ] **Step 7: Implementar `list-seller-items.ts`**

```ts
import type { Item, ItemListFilter, ItemRepository } from "@/domain/repositories/item-repository";

export async function listSellerItems(
  itemRepo: ItemRepository,
  sellerId: string,
  filter?: ItemListFilter,
): Promise<Item[]> {
  return itemRepo.findBySellerId(sellerId, filter);
}
```

- [ ] **Step 8: Rodar para ver passar**

Run: `pnpm test -- run src/application/use-cases/list-seller-items.test.ts`
Expected: PASS (2 tests).
- [ ] **Step 9: Verificação + commit**

Run: `pnpm test`, `npx tsc --noEmit` — Expected: PASS.

```bash
git add src/application/use-cases/delete-item.ts src/application/use-cases/delete-item.test.ts src/application/use-cases/list-seller-items.ts src/application/use-cases/list-seller-items.test.ts
git commit -m "feat: use cases delete-item e list-seller-items"
```

---

### Task 7: Use case `become-seller` (TDD)

**Files:**
- Test: `src/application/use-cases/become-seller.test.ts`
- Create: `src/application/use-cases/become-seller.ts`

**Interfaces:**
- Consumes: `UserRepository`, `UserProfile`, `UserRole`, `createSlug`.
- Produces: `becomeSeller(userRepo, userId, input: { slug: string; role: "seller" | "both" }) → Promise<UserProfile>`.
- Erros: slug inválido propaga de `createSlug`; atualização com slug duplicado propaga erro (mapeado na action).

- [ ] **Step 1: Teste**

`src/application/use-cases/become-seller.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { becomeSeller } from "./become-seller";
import type { UserProfile, UserRepository } from "@/domain/repositories/user-repository";

const baseUser: UserProfile = {
  id: "u1",
  name: "Ana",
  email: "ana@ex.com",
  phone: null,
  slug: null,
  address: null,
  role: "bidder",
};

class FakeUserRepository implements UserRepository {
  constructor(public current: UserProfile = baseUser) {}
  async findById() {
    return this.current;
  }
  async updateProfile(_: string, input: Record<string, unknown>) {
    return { ...this.current, ...input } as UserProfile;
  }
  async findBySlug() {
    return null;
  }
  async updateRole(_: string, role: UserProfile["role"], slug: string) {
    this.current = { ...this.current, role, slug };
    return this.current;
  }
}

describe("becomeSeller", () => {
  it("normaliza o slug e promove o papel para seller", async () => {
    const repo = new FakeUserRepository();
    const user = await becomeSeller(repo, "u1", { slug: "Loja do Nerd", role: "seller" });
    expect(user.role).toBe("seller");
    expect(user.slug).toBe("loja-do-nerd");
  });

  it("permite papel both", async () => {
    const repo = new FakeUserRepository();
    const user = await becomeSeller(repo, "u1", { slug: "nerd-colecionaveis", role: "both" });
    expect(user.role).toBe("both");
  });

  it("rejeita slug inválido antes de persistir", async () => {
    const repo = new FakeUserRepository();
    await expect(becomeSeller(repo, "u1", { slug: "!!", role: "seller" })).rejects.toThrow();
    expect(repo.current.slug).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `pnpm test -- run src/application/use-cases/become-seller.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/application/use-cases/become-seller.ts`:

```ts
import { createSlug } from "@/domain/value-objects/slug";
import type { UserProfile, UserRepository } from "@/domain/repositories/user-repository";

export type SellerRole = "seller" | "both";

export async function becomeSeller(
  userRepo: UserRepository,
  userId: string,
  input: { slug: string; role: SellerRole },
): Promise<UserProfile> {
  const slug = createSlug(input.slug);
  return userRepo.updateRole(userId, input.role, slug);
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `pnpm test -- run src/application/use-cases/become-seller.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verificação + commit**

Run: `pnpm test`, `npx tsc --noEmit` — Expected: PASS.

```bash
git add src/application/use-cases/become-seller.ts src/application/use-cases/become-seller.test.ts
git commit -m "feat: use case become-seller (upgrade de papel com slug da vitrine)"
```

---

### Task 8: Repositório Drizzle de itens

**Files:**
- Create: `src/infrastructure/database/repositories/drizzle-item-repository.ts`

**Interfaces:**
- Consumes: `db` (drizzle), `items`, `bids` do schema, `ItemRepository`, tipos `ItemType`/`ItemStatus`.
- Produces: `drizzleItemRepository: ItemRepository` (singleton, padrão do repositório de usuário).

- [ ] **Step 1: Escrever a implementação**

```ts
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { bids, items } from "@/infrastructure/database/schema";
import type { CreateItemInput, Item, ItemRepository, ItemStatus, ItemType } from "@/domain/repositories/item-repository";

const select = {
  id: items.id,
  sellerId: items.sellerId,
  title: items.title,
  description: items.description,
  type: items.type,
  imageUrl: items.imageUrl,
  minInitialBid: items.minInitialBid,
  minBidIncrement: items.minBidIncrement,
  bidDeadline: items.bidDeadline,
  paymentDeadlineDays: items.paymentDeadlineDays,
  status: items.status,
  createdAt: items.createdAt,
  updatedAt: items.updatedAt,
};

function toItem(row: typeof select & { type: ItemType; status: ItemStatus }): Item {
  return {
    id: row.id,
    sellerId: row.sellerId,
    title: row.title,
    description: row.description,
    type: row.type,
    imageUrl: row.imageUrl,
    minInitialBid: row.minInitialBid,
    minBidIncrement: row.minBidIncrement,
    bidDeadline: row.bidDeadline,
    paymentDeadlineDays: row.paymentDeadlineDays,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const drizzleItemRepository: ItemRepository = {
  async create(input: CreateItemInput) {
    const [row] = await db
      .insert(items)
      .values({
        sellerId: input.sellerId,
        title: input.title,
        description: input.description,
        type: input.type,
        minInitialBid: input.minInitialBid,
        minBidIncrement: input.minBidIncrement,
        bidDeadline: input.bidDeadline,
        paymentDeadlineDays: input.paymentDeadlineDays,
      })
      .returning(select);
    return toItem(row!);
  },

  async update(id, input) {
    const [row] = await db
      .update(items)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.minInitialBid !== undefined ? { minInitialBid: input.minInitialBid } : {}),
        ...(input.minBidIncrement !== undefined ? { minBidIncrement: input.minBidIncrement } : {}),
        ...(input.bidDeadline !== undefined ? { bidDeadline: input.bidDeadline } : {}),
        ...(input.paymentDeadlineDays !== undefined ? { paymentDeadlineDays: input.paymentDeadlineDays } : {}),
      })
      .where(eq(items.id, id))
      .returning(select);
    return row ? toItem(row) : null;
  },

  async findById(id) {
    const [row] = await db.select(select).from(items).where(eq(items.id, id)).limit(1);
    return row ? toItem(row) : null;
  },

  async findBySellerId(sellerId, filter) {
    const conditions = [eq(items.sellerId, sellerId)];
    if (filter?.status) conditions.push(eq(items.status, filter.status));
    const rows = await db
      .select(select)
      .from(items)
      .where(...conditions)
      .orderBy(desc(items.createdAt));
    return rows.map(toItem);
  },

  async delete(id) {
    await db.delete(items).where(eq(items.id, id));
  },

  async setStatus(id, status) {
    const [row] = await db
      .update(items)
      .set({ status })
      .where(eq(items.id, id))
      .returning(select);
    return row ? toItem(row) : null;
  },

  async countBids(itemId) {
    const [row] = await db
      .select({ n: count() })
      .from(bids)
      .where(eq(bids.itemId, itemId));
    return row?.n ?? 0;
  },
};
```

- [ ] **Step 2: Smoke test no banco real**

Com Docker de pé (`db` healthy), rodar via tsx um script temporário que cria e apaga um item (`node --experimental-strip-types`), por exemplo:

Run: `pnpm dev` e conferir em `psql` (lista vazia inicialmente). Alternativa rápida: `pnpm db:generate` para garantir schema em dia (Expected: no changes).

- [ ] **Step 3: Verificação de tipos + commit**

Run: `npx tsc --noEmit` — Expected: PASS.

```bash
git add src/infrastructure/database/repositories/drizzle-item-repository.ts
git commit -m "feat: repositório Drizzle de itens"
```

---

### Task 9: Validações zod (item e become-seller)

**Files:**
- Modify: `src/lib/validators.ts`
- Test: `src/lib/validators.test.ts` (novo)

**Interfaces:**
- Produces: `itemSchema`, `becomeSellerSchema` (zod), exportados de `src/lib/validators.ts`.

- [ ] **Step 1: Escrever os schemas**

Em `src/lib/validators.ts`, adicionar (valores monetários entram em reais do form e saem como centavos inteiros):

```ts
import { createSlug } from "@/domain/value-objects/slug";

const reaisToCents = (v: number) => Math.round(v * 100);

export const itemSchema = z.object({
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres").max(150, "Título muito longo"),
  description: z.string().min(10, "Descrição deve ter no mínimo 10 caracteres").max(5000, "Descrição muito longa"),
  type: z.enum(["product", "service", "piece"], { message: "Tipo inválido" }),
  minInitialBid: z.coerce.number().positive("Lance mínimo inválido").refine((v) => v >= 1, "Lance mínimo deve ser de pelo menos R$ 1,00").transform(reaisToCents),
  minBidIncrement: z.coerce.number().positive("Incremento mínimo inválido").refine((v) => v >= 1, "Incremento mínimo deve ser de pelo menos R$ 1,00").transform(reaisToCents),
  bidDeadline: z.coerce.date({ message: "Prazo de lances inválido" }).refine((d) => d.getTime() > Date.now(), "Prazo de lances deve ser no futuro"),
  paymentDeadlineDays: z.coerce.number().int("Dias de pagamento inválido").min(1, "Mínimo 1 dia para pagamento").max(30, "Máximo 30 dias para pagamento").default(3),
});

export const becomeSellerSchema = z.object({
  slug: z.string().trim().min(1, "Slug obrigatório").transform((v) => createSlug(v)),
  role: z.enum(["seller", "both"], { message: "Papel inválido" }),
});
```

> Nota sobre tipos: `z.coerce.number()` converte string vazia para `0` → falha no `refine`, comportamento desejado. O `transform` roda após as validações de reais; o dado persistido é `integer` em centavos (ex.: `"50.00"` → `5000`). `bidDeadline` recebe `datetime-local` (`2026-09-20T14:00`), que `z.coerce.date()` parseia como Date. Felizmente o `paymentDeadlineDays` recebe `"3"` → 3.

- [ ] **Step 2: Escrever o teste**

`src/lib/validators.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { becomeSellerSchema, itemSchema } from "./validators";

describe("itemSchema", () => {
  it("aceita dados válidos e converte reais para centavos", () => {
    const result = itemSchema.safeParse({
      title: "Action Figure rara",
      description: "Colecionável lacrado em estojo.",
      type: "product",
      minInitialBid: "50.00",
      minBidIncrement: "5.00",
      bidDeadline: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minInitialBid).toBe(5000);
      expect(result.data.minBidIncrement).toBe(500);
      expect(result.data.paymentDeadlineDays).toBe(3);
    }
  });

  it("rejeita deadline no passado", () => {
    expect(
      itemSchema.safeParse({
        title: "Action Figure rara",
        description: "Colecionável lacrado em estojo.",
        type: "product",
        minInitialBid: "50.00",
        minBidIncrement: "5.00",
        bidDeadline: new Date(Date.now() - 1000).toISOString(),
      }).success,
    ).toBe(false);
  });

  it("rejeita valores abaixo de R$ 1,00", () => {
    expect(
      itemSchema.safeParse({
        title: "Action Figure rara",
        description: "Colecionável lacrado em estojo.",
        type: "product",
        minInitialBid: "0.50",
        minBidIncrement: "5.00",
        bidDeadline: new Date(Date.now() + 86400000).toISOString(),
      }).success,
    ).toBe(false);
  });
});

describe("becomeSellerSchema", () => {
  it("normaliza slug", () => {
    const result = becomeSellerSchema.safeParse({ slug: "  Loja do Nerd ", role: "seller" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slug).toBe("loja-do-nerd");
  });

  it("rejeita slug inválido", () => {
    expect(becomeSellerSchema.safeParse({ slug: "!!", role: "seller" }).success).toBe(false);
  });

  it("rejeita papel inválido", () => {
    expect(becomeSellerSchema.safeParse({ slug: "nerd", role: "admin" }).success).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar teste para ver falhar**

Run: `pnpm test -- run src/lib/validators.test.ts`
Expected: FAIL (schemas ausentes) — ou PASS se o arquivo de teste falha por import inexistente.

- [ ] **Step 4: Rodar para ver passar**

Após Step 1 implementado, run: `pnpm test -- run src/lib/validators.test.ts`
Expected: PASS (6 tests).
- [ ] **Step 5: Verificação + commit**

Run: `pnpm test`, `npx tsc --noEmit` — Expected: PASS.

```bash
git add src/lib/validators.ts src/lib/validators.test.ts
git commit -m "feat: schemas zod de item e become-seller"
```

---

### Task 10: Server actions de item + become-seller

**Files:**
- Create: `src/presentation/actions/item-actions.ts`
- Modify: `src/presentation/actions/profile-actions.ts`

**Interfaces:**
- Consumes: `getSession`, `formToObject`, `itemSchema`, `becomeSellerSchema`, use cases de item/become-seller, `drizzleItemRepository`, `drizzleUserRepository`.
- Produces: `createItemAction(_prev, formData)`, `updateItemAction(_prev, formData)`, `publishItemAction(_prev, formData)`, `cancelItemAction(_prev, formData)`, `deleteItemAction(_prev, formData)`, `becomeSellerAction(_prev, formData)` — retorno `ActionResult`.

- [ ] **Step 1: Criar item-actions.ts**

`src/presentation/actions/item-actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { getSession } from "./auth-actions";
import { formToObject, itemSchema } from "@/lib/validators";
import { createItem } from "@/application/use-cases/create-item";
import { updateItem } from "@/application/use-cases/update-item";
import { publishItem } from "@/application/use-cases/publish-item";
import { cancelItem } from "@/application/use-cases/cancel-item";
import { deleteItem } from "@/application/use-cases/delete-item";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";

export type ItemActionResult = { ok?: boolean; error?: string };

export async function createItemAction(_prev: ItemActionResult, formData: FormData): Promise<ItemActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const parsed = itemSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    await createItem(drizzleItemRepository, drizzleUserRepository, session.user.id, parsed.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível criar o item. Tente novamente." };
  }
  redirect("/dashboard/items");
}

export async function updateItemAction(_prev: ItemActionResult, formData: FormData): Promise<ItemActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const id = String(formData.get("id") ?? "");
  const parsed = itemSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    await updateItem(drizzleItemRepository, session.user.id, id, parsed.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível salvar o item. Tente novamente." };
  }
  redirect("/dashboard/items");
}

export async function publishItemAction(_prev: ItemActionResult, formData: FormData): Promise<ItemActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const id = String(formData.get("id") ?? "");
  try {
    await publishItem(drizzleItemRepository, session.user.id, id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível publicar o item." };
  }
  redirect("/dashboard/items");
}

export async function cancelItemAction(_prev: ItemActionResult, formData: FormData): Promise<ItemActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const id = String(formData.get("id") ?? "");
  try {
    await cancelItem(drizzleItemRepository, session.user.id, id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível cancelar o item." };
  }
  redirect("/dashboard/items");
}

export async function deleteItemAction(_prev: ItemActionResult, formData: FormData): Promise<ItemActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const id = String(formData.get("id") ?? "");
  try {
    await deleteItem(drizzleItemRepository, session.user.id, id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível excluir o item." };
  }
  redirect("/dashboard/items");
}
```

> Nota: server actions com `redirect()` dentro do `try` funcionam — o `redirect` lança `NEXT_REDIRECT`, que propaga; o catch NÃO deve capturá-lo. Em Next, `redirect()` lança e não deve passar pelo catch — garantir que usuários com o redirect não caiam no catch. O catch acima captura apenas erros comuns; para garantir, usar `redirect()` fora do `try`. Ajuste recomendado — refazer cada action no estilo:

```ts
  let ok = false;
  try {
    await createItem(...);
    ok = true;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível criar o item. Tente novamente." };
  }
  if (ok) redirect("/dashboard/items");
```

- [ ] **Step 2: Adicionar becomeSellerAction**

Em `src/presentation/actions/profile-actions.ts`, adicionar:

```ts
import { becomeSeller } from "@/application/use-cases/become-seller";

export type SellerActionResult = { ok?: boolean; error?: string };

export async function becomeSellerAction(_prev: SellerActionResult | null, formData: FormData): Promise<SellerActionResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const parsed = becomeSellerSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    await becomeSeller(drizzleUserRepository, session.user.id, parsed.data);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes("23505") || raw.includes("duplicate")) {
      return { error: "Este slug já está em uso" };
    }
    return { error: raw || "Não foi possível ativar a conta de leiloeiro." };
  }
  return { ok: true };
}
```

E importar `becomeSellerSchema` em `profile-actions.ts`.

- [ ] **Step 3: Verificação**

Run: `npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add src/presentation/actions/item-actions.ts src/presentation/actions/profile-actions.ts
git commit -m "feat: server actions de item e become-seller"
```

---

### Task 11: Componentes UI (badge, form de item, form become-seller)

**Files:**
- Create: `src/components/item-status-badge.tsx`
- Create: `src/components/item-form.tsx`
- Create: `src/components/become-seller-form.tsx`

**Interfaces:**
- Consumes: `Item`, `ItemStatus`, `ItemType`, `createItemAction`/`updateItemAction`, `becomeSellerAction`, shadcn `Button/Input/Label/Card`.
- Produces: `ItemStatusBadge({ status })`, `ItemForm({ item?, mode })`, `become-seller-form` (renderizado em settings quando role não é seller).

- [ ] **Step 1: Badge de status**

`src/components/item-status-badge.tsx`:

```tsx
import type { ItemStatus } from "@/domain/repositories/item-repository";

const LABELS: Record<ItemStatus, string> = {
  draft: "Rascunho",
  active: "Em leilão",
  closed: "Encerrado",
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  cancelled: "Cancelado",
};

const CLASSES: Record<ItemStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-100 text-emerald-800",
  closed: "bg-sky-100 text-sky-800",
  awaiting_payment: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-destructive/10 text-destructive",
};

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASSES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 2: Form de item**

`src/components/item-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createItemAction, updateItemAction } from "@/presentation/actions/item-actions";
import type { Item } from "@/domain/repositories/item-repository";

export function ItemForm({ item, mode }: { item?: Item | null; mode: "create" | "edit" }) {
  const router = useRouter();
  const action = mode === "create" ? createItemAction : updateItemAction;
  const [state, formAction, pending] = useActionState(action, null as { error?: string; ok?: boolean } | null);
  const locked = mode === "edit" && item?.status !== "draft";

  useEffect(() => {
    if (state && state.ok) router.push("/dashboard/items");
  }, [state, router]);

  const formattedDate = item?.bidDeadline
    ? new Date(item.bidDeadline.getTime() - item.bidDeadline.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : undefined;

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      {state && "error" in state && state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {locked ? <p className="text-sm text-amber-600">Item publicado — edição bloqueada.</p> : null}
      {mode === "edit" && item ? <input type="hidden" name="id" value={item.id} /> : null}
      <div className={locked ? "grid grid-cols-1 gap-4 opacity-60 sm:grid-cols-2" : "grid grid-cols-1 gap-4 sm:grid-cols-2"}>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Título</Label>
          <Input id="title" name="title" defaultValue={item?.title} required maxLength={150} disabled={locked} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Descrição</Label>
          <textarea
            id="description"
            name="description"
            defaultValue={item?.description}
            required
            minLength={10}
            maxLength={5000}
            rows={4}
            disabled={locked}
            className="rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <select id="type" name="type" defaultValue={item?.type ?? "product"} required disabled={locked} className="rounded-md border bg-background px-3 py-2 text-sm">
            <option value="product">Produto</option>
            <option value="service">Serviço</option>
            <option value="piece">Peça colecionável</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="paymentDeadlineDays">Dias para pagamento</Label>
          <Input id="paymentDeadlineDays" name="paymentDeadlineDays" type="number" min={1} max={30} defaultValue={item?.paymentDeadlineDays ?? 3} required disabled={locked} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minInitialBid">Lance mínimo (R$)</Label>
          <Input id="minInitialBid" name="minInitialBid" type="number" min={1} step="0.01" defaultValue={item ? item.minInitialBid / 100 : undefined} required disabled={locked} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minBidIncrement">Incremento mínimo (R$)</Label>
          <Input id="minBidIncrement" name="minBidIncrement" type="number" min={1} step="0.01" defaultValue={item ? item.minBidIncrement / 100 : undefined} required disabled={locked} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="bidDeadline">Prazo para lances</Label>
          <Input id="bidDeadline" name="bidDeadline" type="datetime-local" defaultValue={formattedDate} required disabled={locked} />
        </div>
      </div>
      <Button type="submit" disabled={pending || locked}>{mode === "create" ? "Criar item" : "Salvar alterações"}</Button>
    </form>
  );
}
```

> Consistência de unidades: o form exibe e envia valores em **reais** (ex.: "50.00"); o `itemSchema` (Task 9) converte para centavos inteiros antes de persistir. O `defaultValue` para edição divide `minInitialBid/100` para reais — correto.

- [ ] **Step 3: Form become-seller**

`src/components/become-seller-form.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSlug } from "@/domain/value-objects/slug";
import { becomeSellerAction } from "@/presentation/actions/profile-actions";

export function BecomeSellerForm() {
  const [state, action, pending] = useActionState(becomeSellerAction, null as { error?: string; ok?: boolean } | null);
  const [raw, setRaw] = useState("");

  let preview = "";
  try {
    preview = createSlug(raw);
  } catch {
    preview = "";
  }

  return (
    <form action={action} className="max-w-md space-y-4">
      {state && "error" in state && state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state && state.ok ? <p className="text-sm text-emerald-600">Conta de leiloeiro ativada.</p> : null}
      <div className="space-y-2">
        <Label htmlFor="slug">Slug da vitrine</Label>
        <Input id="slug" name="slug" placeholder="nerd-colecionaveis" value={raw} onChange={(e) => setRaw(e.target.value)} />
        {preview ? <p className="text-sm text-muted-foreground">leiloeironerd.com/{preview}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Ativar como</Label>
        <select id="role" name="role" className="w-full rounded-md border bg-background px-3 py-2 text-sm" defaultValue="seller">
          <option value="seller">Leiloeiro</option>
          <option value="both">Leiloeiro e arrematante</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>Ativar conta de leiloeiro</Button>
    </form>
  );
}
```

- [ ] **Step 4: Verificação**

Run: `npx tsc --noEmit` e `pnpm test` — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/components/item-status-badge.tsx src/components/item-form.tsx src/components/become-seller-form.tsx
git commit -m "feat: componentes de item e become-seller"
```

---

### Task 12: Páginas do dashboard de itens

**Files:**
- Create: `src/app/(dashboard)/dashboard/items/page.tsx`
- Create: `src/app/(dashboard)/dashboard/items/items-list.tsx`
- Create: `src/app/(dashboard)/dashboard/items/new/page.tsx`
- Create: `src/app/(dashboard)/dashboard/items/[id]/edit/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/settings/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx` (link para items)

**Interfaces:**
- Consumes: `getSession`, `listSellerItems`, `drizzleItemRepository`, `ItemForm`, `ItemStatusBadge`, item actions, `Item`, `ItemStatus`.
- Produces: rotas `/dashboard/items*`; settings exibe `BecomeSellerForm` para não-sellers.

- [ ] **Step 1: Página de listagem**

Em `src/app/(dashboard)/dashboard/items/page.tsx`:

```tsx
import { getSession } from "@/presentation/actions/auth-actions";
import { listSellerItems } from "@/application/use-cases/list-seller-items";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import type { ItemStatus } from "@/domain/repositories/item-repository";
import { ItemsList } from "./items-list";
import { BecomeSellerForm } from "@/components/become-seller-form";

export const dynamic = "force-dynamic";

export default async function ItemsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) return null;
  const isSeller = session.user.role === "seller" || session.user.role === "both";
  const { status } = await searchParams;
  const items = isSeller
    ? await listSellerItems(drizzleItemRepository, session.user.id, status ? { status: status as ItemStatus } : undefined)
    : [];

  if (!isSeller) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Meus itens</h1>
        <p className="text-muted-foreground">Você ainda não é leiloeiro.</p>
        <BecomeSellerForm />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meus itens</h1>
        <a href="/dashboard/items/new" className="text-sm font-medium text-primary underline">+ Novo item</a>
      </div>
      <ItemsList items={items} current={typeof status === "string" && status ? status : "all"} />
    </div>
  );
}
```

> Nota: `PageProps` é um helper global do Next 16 (tipa `params`/`searchParams` como Promise). No ItemForm, quando `locked` (item publicado), todos os campos e o botão ficam `disabled` — o use case bloqueia qualquer edição pós-publicação, e a UI previne o envio.

`src/app/(dashboard)/dashboard/items/items-list.tsx`:

```tsx
import Link from "next/link";
import type { Item, ItemStatus } from "@/domain/repositories/item-repository";
import { ItemStatusBadge } from "@/components/item-status-badge";
import { cancelItemAction, deleteItemAction, publishItemAction } from "@/presentation/actions/item-actions";

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "draft", label: "Rascunho" },
  { key: "active", label: "Em leilão" },
  { key: "closed", label: "Encerrado" },
  { key: "cancelled", label: "Cancelado" },
];

export function ItemsList({ items, current }: { items: Item[]; current: string }) {
  const visible = current === "all" || current === "" ? items : items.filter((i) => i.status === current);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/dashboard/items" : `/dashboard/items?status=${tab.key}`}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              current === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground">Nenhum item neste status.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li key={item.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">Lance mínimo: R$ {(item.minInitialBid / 100).toFixed(2)}</p>
                </div>
                <ItemStatusBadge status={item.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.status === "draft" ? (
                  <>
                    <Link href={`/dashboard/items/${item.id}/edit`} className="text-sm font-medium text-primary underline">Editar</Link>
                    <form action={publishItemAction}><input type="hidden" name="id" value={item.id} /><button type="submit" className="text-sm font-medium text-emerald-600 underline">Publicar</button></form>
                    <form action={deleteItemAction}><input type="hidden" name="id" value={item.id} /><button type="submit" className="text-sm font-medium text-destructive underline">Excluir</button></form>
                  </>
                ) : null}
                {item.status === "active" || item.status === "closed" ? (
                  <form action={cancelItemAction}><input type="hidden" name="id" value={item.id} /><button type="submit" className="text-sm font-medium text-destructive underline">Cancelar</button></form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

> Os botões de ação inline (Publicar/Excluir/Cancelar) são `<form>` com server action direta e `<button>` estilizado — não usam `useActionState` (a action faz `redirect` e a navegação recarrega a lista). Este é o comportamento desejado.

- [ ] **Step 2: Página de criação**

`src/app/(dashboard)/dashboard/items/new/page.tsx`:

```tsx
import { ItemForm } from "@/components/item-form";

export default function NewItemPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Novo item</h1>
      <ItemForm mode="create" />
    </div>
  );
}
```

- [ ] **Step 3: Página de edição**

`src/app/(dashboard)/dashboard/items/[id]/edit/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { ItemForm } from "@/components/item-form";

export const dynamic = "force-dynamic";

export default async function EditItemPage({ params }: PageProps) {
  const [session, { id }] = await Promise.all([getSession(), params]);
  if (!session) return null;
  const item = await drizzleItemRepository.findById(id);
  if (!item || item.sellerId !== session.user.id) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Editar item</h1>
      <ItemForm item={item} mode="edit" />
    </div>
  );
}
```

- [ ] **Step 4: Settings exibe become-seller; dashboard link para items**

Em `src/app/(dashboard)/dashboard/settings/page.tsx`:

```tsx
import { getSession } from "@/presentation/actions/auth-actions";
import { SettingsForm } from "./settings-form";
import { BecomeSellerForm } from "@/components/become-seller-form";

export default async function SettingsPage() {
  const session = await getSession();
  const isSeller = session?.user.role === "seller" || session?.user.role === "both";
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>
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

Nota: `page.tsx` de settings já existe; mudar de página estática síncrona para `async` + `force-dynamic` (chama `getSession` → leitura de cookie). Adicionar `export const dynamic = "force-dynamic";`.

Em `src/app/(dashboard)/dashboard/page.tsx`, adicionar link:

```tsx
      <p>
        <a className="text-primary underline" href="/dashboard/settings">Editar perfil</a>
        {" · "}
        <a className="text-primary underline" href="/dashboard/items">Meus itens</a>
      </p>
```

- [ ] **Step 5: Verificação**

Run: `npx tsc --noEmit`, `pnpm lint` — Expected: PASS.

Build com dev server: `pnpm dev` e navegar para `/login`, criar conta, ativar leiloeiro em settings, criar item, publicar, verificar lista. (Teste manual.)

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/items src/app/\(dashboard\)/dashboard/settings/page.tsx src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: páginas do dashboard de itens e upgrade de role em settings"
```

---

### Task 13: Verificação final

**Files:** nenhum.

- [ ] **Step 1: Suíte completa**

Run: `pnpm test` — Expected: PASS (todos os arquivos).
- [ ] **Step 2: Tipos + lint**

Run: `npx tsc --noEmit` e `pnpm lint` — Expected: limpio.
- [ ] **Step 3: Build**

Run: `pnpm build` — Expected: OK.
- [ ] **Step 4: Smoke manual**

Run: `pnpm dev`; fluxo: register → settings (become-seller) → criar item → publicar → cancelar. Verificar no banco via `docker compose exec db psql -U leiloeiro -d leiloeironerd -c "SELECT id,status FROM items;"`.
- [ ] **Step 5: Commit de quaisquer ajustes e atualizar docs/project.md**

Marcar como concluídos os itens da Fase 2 relativos a itens/dashboard no roadmap:

```bash
git add docs/project.md
git commit -m "docs: atualiza roadmap após sub-projeto 2a"
```