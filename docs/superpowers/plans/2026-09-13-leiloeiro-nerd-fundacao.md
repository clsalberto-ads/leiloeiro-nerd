# Leiloeiro Nerd — Sub-Projeto 1: Fundação — Plano de Implementação

> **Para workers agentic:** SUB-SKILL OBRIGATÓRIO: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa por tarefa. Passos usam `- [ ]` para rastreamento.

**Goal:** Criar a base técnica do Leiloeiro Nerd: Next.js 16 em Docker Compose (PostgreSQL + Redis), schema Drizzle completo, autenticação Better Auth (registro/login/recuperação), shell de dashboard protegido, arquitetura em camadas e worker BullMQ placeholder.

**Architecture:** Clean Architecture pragmática em camadas — use cases são funções puras com dependências injetadas; server actions orquestram deps concretas. Postgres + Redis rodam no mesmo Docker Compose para dev e produção; rede e filas são abstraídas atrás de interfaces no domínio.

**Tech Stack:** Next.js 16.x, TypeScript strict, Tailwind CSS v4 + shadcn/ui, Drizzle ORM (node-postgres), Better Auth (drizzle adapter), PostgreSQL 17, Redis 7, BullMQ, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-13-leiloeiro-nerd-fundacao-design.md`

## Global Constraints

- Node.js `>=20.9.0` (usar Node 24 LTS); pnpm como gerenciador de pacotes.
- TypeScript em modo strict (default do template Next 16).
- Valores monetários são **sempre** `integer` em centavos — nunca `float`.
- Slugs: lowercase, sem acentos, hífens entre palavras, máx. 60 chars (regra implementada em `createSlug`, testes obrigatórios).
- UI e mensagens de erro em **pt-BR**.
- `user.additionalFields` no Better Auth: `role` (enum `seller|bidder|both`, default `bidder`), `slug` (unique, nullable), `phone`, `address`.
- Adapter Drizzle do Better Auth documentado no código (spec §6): mapear `schema: { user, session, account, verification }` apontando para as tabelas do arquivo gerado `auth-schema.ts`, mantido **separado** de `schema.ts` (pode ser regenerado sem conflito).
- `.env` é git-ignored; apenas `.env.example` versionado. Gerar `BETTER_AUTH_SECRET` com `openssl rand -hex 32`.
- Validação de input em server actions feita com Zod (`src/lib/validators.ts`).
- Cada task termina com commit próprio e comando de verificação executado.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts` | Projeto Next 16 (gerados no Task 1) |
| `.nvmrc`, `.gitignore` | Pin Node 24; `.env` ignorado |
| `docker-compose.yml` | Postgres 17 + Redis 7 (dev e produção) |
| `.env.example`, `.env` | Variáveis de ambiente |
| `vitest.config.ts` | Config Vitest (alias `@`) |
| `src/infrastructure/database/schema.ts` | Tabelas do app (items, bids, payments, notifications + indexes) |
| `src/infrastructure/database/auth-schema.ts` | **Gerado** pelo `@better-auth/cli` (user/session/account/verification) |
| `src/infrastructure/database/drizzle.ts` | Pool + client drizzle com schema completo |
| `drizzle.config.ts`, `drizzle/` | Config e migrações |
| `src/infrastructure/auth/better-auth.ts` | Instância auth (adapter + additionalFields + nextCookies) |
| `src/domain/value-objects/slug.ts`, `money.ts` | Regras puras de slug e dinheiro |
| `src/domain/repositories/user-repository.ts` | Contrato do repositório de usuários |
| `src/application/use-cases/update-profile.ts` | Use case de atualização de perfil (função + DI) |
| `src/infrastructure/database/repositories/drizzle-user-repository.ts` | Impl Drizzle do repositório |
| `src/infrastructure/cron/queue.ts`, `worker.ts` | Fila BullMQ + consumer placeholder |
| `src/presentation/actions/auth-actions.ts`, `profile-actions.ts` | Server actions |
| `src/app/(auth)/{login,register,forgot-password}` | Páginas de auth + client forms |
| `src/app/(dashboard)/{layout,dashboard}` | Shell protegido |
| `src/app/api/auth/[...all]/route.ts` | Handler do Better Auth |
| `src/proxy.ts` | Guard leve de `/dashboard` (Next 16 proxy) |
| `src/lib/utils.ts`, `validators.ts` | cn() (shadcn) + schemas Zod |

---

### Task 1: Scaffold do projeto Next.js

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `src/app/*`, `src/app/globals.css` (gerados pelo CLI)
- Modify: `package.json` (engines), `.gitignore`
- Create: `.nvmrc`

**Interfaces:**
- Consumes: nada.
- Produces: projeto Next 16 compilável; base de pastas `src/app`; `pnpm` instalado.

- [ ] **Step 1: Gerar o projeto**

Do diretório raiz (vazio de código), dentro de `leiloeiro-nerd`:

```bash
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*" --use-pnpm --yes
```

Se o CLI do Next 16 rejeitar alguma flag, refaça sem `--yes` e responda os prompts escolhendo: TypeScript, Tailwind, ESLint, App Router, `src/` dir, alias `@/*`, Turbopack.

- [ ] **Step 2: Verificar build base**

```bash
pnpm build
```

Esperado: build completo sem erros.

- [ ] **Step 3: Pin Node e engines**

Crie `.nvmrc` com:

```
24
```

Em `package.json` adicione:

```json
"engines": { "node": ">=20.9.0" }
```

- [ ] **Step 4: Garantir .env ignorado**

Confira em `.gitignore` que contém `.env*` **e** `!.env.example` (adicionar se faltar).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 com TypeScript, Tailwind e Turbopack"
```

---

### Task 2: shadcn/ui base

**Files:**
- Modify: `components.json` (gerado)
- Create: `src/components/ui/button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`
- Modify: `src/lib/utils.ts`, `src/app/globals.css`

**Interfaces:**
- Consumes: Task 1 (projeto com Tailwind).
- Produces: componentes `Button`, `Input`, `Label`, `Card` usados nas páginas de auth.

- [ ] **Step 1: Init shadcn**

```bash
pnpm dlx shadcn@latest init -d
```

- [ ] **Step 2: Adicionar componentes base**

```bash
pnpm dlx shadcn@latest add button input label card
```

- [ ] **Step 3: Verificar build**

```bash
pnpm build
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: init shadcn/ui com componentes base"
```

---

### Task 3: Value objects Slug e Money (TDD + Vitest)

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/constants.ts`
- Create: `src/domain/value-objects/slug.ts`
- Test: `src/domain/value-objects/slug.test.ts`
- Create: `src/domain/value-objects/money.ts`
- Test: `src/domain/value-objects/money.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `createSlug(raw: string): string` — normaliza e valida; lança `Error` se vazio, >60 chars ou inválido.
  - `money(cents: number): Money` — lança se não for inteiro. `Money = { readonly cents: number }`.
  - `moneyFromReais(value: number): Money` — `Math.round(value * 100)`.
  - `moneyToReais(m: Money): number`.
  - `moneyAdd(a: Money, b: Money): Money`.

- [ ] **Step 1: Configurar Vitest**

`vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

Em `package.json`, script: `"test": "vitest run"`.

- [ ] **Step 2: Escrever o teste do slug (falha)**

`src/domain/value-objects/slug.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSlug } from "./slug";

describe("createSlug", () => {
  it("normaliza acentos e espaços", () => {
    expect(createSlug("Nerd Colecionáveis")).toBe("nerd-colecionaveis");
  });

  it("substitui não alfanuméricos por hífen único", () => {
    expect(createSlug("Café & Cia -- 25")).toBe("cafe-cia-25");
  });

  it("lança erro quando o resultado é vazio", () => {
    expect(() => createSlug("   !!  ")).toThrow();
  });

  it("lança erro quando excede 60 caracteres", () => {
    expect(() => createSlug("a".repeat(61))).toThrow();
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar falha**

```bash
pnpm test -- src/domain/value-objects/slug.test.ts
```

Esperado: FAIL — `createSlug` não existe.

- [ ] **Step 4: Implementar o slug**

`src/lib/constants.ts`:

```ts
export const MAX_SLUG_LENGTH = 60;
```

`src/domain/value-objects/slug.ts`:

```ts
import { MAX_SLUG_LENGTH } from "@/lib/constants";

const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createSlug(raw: string): string {
  const slug = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length === 0) throw new Error("Slug não pode ser vazio");
  if (slug.length > MAX_SLUG_LENGTH) throw new Error("Slug excede 60 caracteres");
  if (!VALID_SLUG.test(slug)) throw new Error("Slug contém caracteres inválidos");
  return slug;
}
```

- [ ] **Step 5: Rodar o teste e confirmar pass**

```bash
pnpm test -- src/domain/value-objects/slug.test.ts
```

Esperado: PASS (4 tests).

- [ ] **Step 6: Escrever o teste do money (falha)**

`src/domain/value-objects/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { money, moneyAdd, moneyFromReais, moneyToReais } from "./money";

describe("money", () => {
  it("aceita centavos inteiros", () => {
    expect(money(150).cents).toBe(150);
  });

  it("rejeita valores não inteiros", () => {
    expect(() => money(1.5)).toThrow();
  });

  it("converte reais para centavos sem precisão flutuante", () => {
    expect(moneyFromReais(12.34).cents).toBe(1234);
    expect(moneyFromReais(0.1).cents).toBe(10);
  });

  it("converte centavos para reais", () => {
    expect(moneyToReais(money(12345))).toBe(123.45);
  });

  it("soma em centavos", () => {
    expect(moneyAdd(money(100), money(250)).cents).toBe(350);
  });
});
```

- [ ] **Step 7: Rodar e confirmar falha**

```bash
pnpm test -- src/domain/value-objects/money.test.ts
```

Esperado: FAIL — módulo não existe.

- [ ] **Step 8: Implementar o money**

`src/domain/value-objects/money.ts`:

```ts
export type Money = { readonly cents: number };

export function money(cents: number): Money {
  if (!Number.isInteger(cents)) throw new Error("Money deve ser em centavos inteiros");
  return { cents };
}

export function moneyFromReais(value: number): Money {
  if (!Number.isFinite(value) || value < 0) throw new Error("Valor em reais inválido");
  return money(Math.round(value * 100));
}

export function moneyToReais({ cents }: Money): number {
  return cents / 100;
}

export function moneyAdd(a: Money, b: Money): Money {
  return money(a.cents + b.cents);
}
```

- [ ] **Step 9: Rodar e confirmar pass**

```bash
pnpm test
```

Esperado: PASS — 9 tests (4 slug + 5 money).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: value objects slug e money com Vitest"
```

---

### Task 4: Docker Compose (Postgres 17 + Redis 7) e variáveis de ambiente

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.env` (copiado, git-ignored)

**Interfaces:**
- Produces: serviços `db` (PG 5432) e `redis` (6379) saudáveis; `DATABASE_URL` e `REDIS_URL` disponíveis para Tasks 5–9.

- [ ] **Step 1: Escrever o compose**

`docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-leiloeiro}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-leiloeiro}
      POSTGRES_DB: ${POSTGRES_DB:-leiloeironerd}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-leiloeiro} -d ${POSTGRES_DB:-leiloeironerd}"]
      interval: 5s
      timeout: 5s
      retries: 5
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  redisdata:
```

- [ ] **Step 2: Escrever .env.example**

`.env.example`:

```env
# Database
DATABASE_URL=postgresql://leiloeiro:leiloeiro@localhost:5432/leiloeironerd

# Redis
REDIS_URL=redis://localhost:6379

# Better Auth
BETTER_AUTH_SECRET=<openssl rand -hex 32>
BETTER_AUTH_URL=http://localhost:3000

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Mercado Pago (ativa a partir da Fase 3)
MERCADO_PAGO_ACCESS_TOKEN=TEST-xxxx
MERCADO_PAGO_PUBLIC_KEY=TEST-xxxx
MERCADO_PAGO_WEBHOOK_SECRET=xxxx

# Resend (ativa a partir da Fase 3)
RESEND_API_KEY=re_xxxx
RESEND_FROM_EMAIL=Leiloeiro Nerd <noreply@leiloeironerd.com>
```

- [ ] **Step 3: Gerar .env real**

```bash
cp .env.example .env
# substitua BETTER_AUTH_SECRET pelo valor de: openssl rand -hex 32
```

- [ ] **Step 4: Subir e verificar health**

```bash
docker compose up -d
docker compose ps
```

Esperado: `db` e `redis` com status `healthy` (aguardar alguns segundos).

- [ ] **Step 5: Verificar conectividade Postgres**

```bash
docker compose exec db pg_isready -U leiloeiro -d leiloeironerd
```

Esperado: `accepting connections`.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "chore: docker compose com Postgres 17 e Redis 7 + variáveis de ambiente"
```

---

### Task 5: Gerar o schema do Better Auth (auth-schema.ts)

**Files:**
- Create: `src/infrastructure/database/drizzle.ts` (client v1, sem schema)
- Create: `src/infrastructure/auth/better-auth.ts` (config **provisória**, sem adapter)
- Modify: `package.json` (script `auth:generate`)

**Interfaces:**
- Produces: `src/infrastructure/database/auth-schema.ts` **gerado** com as tabelas `user`/`session`/`account`/`verification` (ou pluralizadas, conforme a versão) **incluindo os `additionalFields`**.
- Consumes: Task 4 (env vars).

- [ ] **Step 1: Escrever client drizzle v1**

`src/infrastructure/database/drizzle.ts`:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool);
```

- [ ] **Step 2: Escrever config provisória do Better Auth**

`src/infrastructure/auth/better-auth.ts` (TEMP — será completada no Task 6):

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true },
  emailSender: {
    // Placeholder até a Fase 3 (Resend): loga o link de redefinição no console.
    sendResetPassword: async ({ url }) => {
      console.log("[DEV] link de redefinição de senha:", url);
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "bidder", input: false },
      slug: { type: "string", required: false, unique: true },
      phone: { type: "string", required: false },
      address: { type: "string", required: false },
    },
  },
});
```

> Nota: os `additionalFields` precisam existir **antes** do `generate` para que as colunas entrem no schema gerado.

- [ ] **Step 3: Adicionar script de geração**

Em `package.json`:

```json
"auth:generate": "@better-auth/cli generate --adapter drizzle --config src/infrastructure/auth/better-auth.ts --output src/infrastructure/database/auth-schema.ts"
```

(Instale `@better-auth/cli` como devDependency se o CLI perguntar; caso alguma flag não seja suportada na versão atual, rode `pnpm dlx @better-auth/cli generate` e responda os prompts: adapter `drizzle`, output `src/infrastructure/database/auth-schema.ts`.)

- [ ] **Step 4: Gerar o auth-schema**

```bash
pnpm auth:generate
```

Esperado: arquivo `src/infrastructure/database/auth-schema.ts` criado.

- [ ] **Step 5: Inspecionar nomes das tabelas geradas**

Abra `auth-schema.ts` e anote: os objetos exportados para o modelo de usuário, session, account e verification têm que nome (ex.: `user`, `session`, `account`, `verification`). Guarde esses nomes para o Task 6.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: gerar auth-schema do Better Auth com additionalFields"
```

---

### Task 6: Schema completo, migração e endpoint de auth

**Files:**
- Modify: `src/infrastructure/database/schema.ts` (create) — tabelas do app
- Modify: `src/infrastructure/auth/better-auth.ts` — final, com adapter
- Modify: `src/infrastructure/database/drizzle.ts` — client com schema completo
- Create: `drizzle.config.ts`, `drizzle/` (migrações)
- Create: `src/app/api/auth/[...all]/route.ts`
- Modify: `package.json` (scripts `db:generate`, `db:migrate`)

**Interfaces:**
- Produces:
  - Tabelas `items`, `bids`, `payments`, `notifications` + enums + índices; FKs p/ a tabela de usuários **importada do auth-schema**.
  - `db` com schema completo (`drizzle(pool, { schema: { ...appSchema, ...authSchema } })`).
  - `auth` final (adapter + `nextCookies()`); handler `/api/auth/*`.
  - Migração inicial aplicada no Postgres.
- Consumes: Task 4 (Postgres de pé), Task 5 (auth-schema gerado).

- [ ] **Step 1: Escrever schema.ts (tabelas do app)**

`src/infrastructure/database/schema.ts`:

```ts
import { integer, index, pgEnum, pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { user as userTable } from "./auth-schema";

export const roleEnum = pgEnum("role", ["seller", "bidder", "both"]);
export const itemTypeEnum = pgEnum("item_type", ["product", "service", "piece"]);
export const itemStatusEnum = pgEnum("item_status", ["draft", "active", "closed", "awaiting_payment", "paid", "cancelled"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "approved", "expired", "cancelled", "refunded"]);
export const notificationTypeEnum = pgEnum("notification_type", ["outbid", "won", "payment_due", "payment_expired", "payment_confirmed"]);

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  sellerId: text("seller_id").notNull().references(() => userTable.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: itemTypeEnum("type").notNull(),
  imageUrl: text("image_url"),
  minInitialBid: integer("min_initial_bid").notNull(),
  minBidIncrement: integer("min_bid_increment").notNull(),
  bidDeadline: timestamp("bid_deadline", { withTimezone: true }).notNull(),
  paymentDeadlineDays: integer("payment_deadline_days").notNull().default(3),
  status: itemStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("items_bid_deadline_status_idx").on(t.bidDeadline, t.status)]);

export const bids = pgTable("bids", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => items.id),
  bidderId: text("bidder_id").notNull().references(() => userTable.id),
  amount: integer("amount").notNull(),
  rank: integer("rank"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("bids_item_id_idx").on(t.itemId)]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => items.id),
  bidderId: text("bidder_id").notNull().references(() => userTable.id),
  bidId: uuid("bid_id").notNull().references(() => bids.id),
  amount: integer("amount").notNull(),
  mpPaymentId: text("mp_payment_id"),
  pixQrCode: text("pix_qr_code"),
  pixQrCodeBase64: text("pix_qr_code_base64"),
  paymentLink: text("payment_link"),
  status: paymentStatusEnum("status").notNull().default("pending"),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  attemptNumber: integer("attempt_number").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("payments_item_id_idx").on(t.itemId), index("payments_status_deadline_idx").on(t.status, t.deadline)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => userTable.id),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("notifications_user_id_idx").on(t.userId)]);
```

> Ajuste o import do `auth-schema` para o nome exportado real da tabela de usuários (anotado no Task 5). Se a tabela gerada for plural (`users`), troque para `import { users as userTable } from "./auth-schema"`.

- [ ] **Step 2: Escrever drizzle.config.ts**

`drizzle.config.ts`:

```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/infrastructure/database/schema.ts", "./src/infrastructure/database/auth-schema.ts"],
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Scripts em `package.json`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate"
```

- [ ] **Step 3: Atualizar o client drizzle**

`src/infrastructure/database/drizzle.ts`:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as appSchema from "./schema";
import * as authSchema from "./auth-schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema: { ...appSchema, ...authSchema } });
export type Database = typeof db;
```

- [ ] **Step 4: Completer o better-auth.ts**

`src/infrastructure/auth/better-auth.ts`:

```ts
// Adapter Drizzle: mapeamos explicitamente os modelos do Better Auth
// para as tabelas do auth-schema.ts, que é o arquivo gerado pelo
// @better-auth/cli e NÃO deve ser editado manualmente.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/infrastructure/database/drizzle";
import { user, session, account, verification } from "@/infrastructure/database/auth-schema";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true },
  emailSender: {
    // Placeholder até a Fase 3 (Resend): loga o link de redefinição no console.
    sendResetPassword: async ({ url }) => {
      console.log("[DEV] link de redefinição de senha:", url);
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "bidder", input: false },
      slug: { type: "string", required: false, unique: true },
      phone: { type: "string", required: false },
      address: { type: "string", required: false },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  plugins: [nextCookies()],
});
```

> Os nomes exportados no import (`user`, `session`, ...) são os da inspeção do Task 5 — ajuste se a versão gerada usar nomes diferentes. A coluna `role` usa `input: false` para não aceitar valor direto do cliente no cadastro.

- [ ] **Step 5: Gerar a migração inicial**

```bash
pnpm db:generate
```

Esperado: arquivo em `drizzle/` com as 5 tabelas do app + tabelas de auth (enums e índices inclusos).

- [ ] **Step 6: Aplicar a migração**

```bash
pnpm db:migrate
```

Esperado: migração aplicada. Conferir:

```bash
docker compose exec db psql -U leiloeiro -d leiloeironerd -c "\dt"
```

Esperado: `users`(ou nome gerado), `items`, `bids`, `payments`, `notifications`, `sessions`, `accounts`, `verifications` presente.

- [ ] **Step 7: Criar o endpoint de auth**

`src/app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/infrastructure/auth/better-auth";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 8: Verificar que os endpoints respondem**

Com `pnpm dev` rodando:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/get-session
```

Esperado: `200`.

- [ ] **Step 9: Verificar build**

```bash
pnpm build
```

Esperado: sem erros.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: schema Drizzle completo, migração inicial e endpoint de auth"
```

---

### Task 7: Páginas de auth, dashboard protegido e proxy

**Files:**
- Create: `src/lib/validators.ts`
- Create: `src/presentation/actions/auth-actions.ts`
- Create: `src/app/(auth)/login/{page.tsx,login-form.tsx}`
- Create: `src/app/(auth)/register/{page.tsx,register-form.tsx}`
- Create: `src/app/(auth)/forgot-password/{page.tsx,forgot-password-form.tsx}`
- Create: `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/dashboard/page.tsx`
- Create: `src/proxy.ts`

**Interfaces:**
- Consumes: Task 6 (`auth` com adapter + handler).
- Produces: 
  - Server actions `signUpAction(prev, formData)`, `signInAction(prev, formData)`, `forgotPasswordAction(prev, formData)` retornando `{ ok: true }` ou `{ error: string }` (tipo `ActionResult` exportado).
  - `getSession()` (helper em `auth-actions.ts`) usado por layout e profile action.
  - Dashboard protegido (redirect `/login`).

- [ ] **Step 1: Escrever validators Zod**

`src/lib/validators.ts`:

```ts
import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
});

export const signInSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

/** Converte FormData num objeto plano para validação Zod em server actions. */
export function formToObject(formData: FormData): Record<string, string> {
  return Object.fromEntries(formData.entries()) as Record<string, string>;
}
```

(Instale `zod` se não estiver no package.json.)

- [ ] **Step 2: Escrever as server actions de auth**

> Todas as actions abaixo usam a assinatura `(prevState, formData)` exigida pelo `useActionState` do React 19 / Next 16: o segundo argumento é um `FormData`, convertido com `formToObject` antes da validação Zod.

`src/presentation/actions/auth-actions.ts`:

```ts
"use server";

import { headers } from "next/headers";
import { auth } from "@/infrastructure/auth/better-auth";
import { forgotPasswordSchema, formToObject, signInSchema, signUpSchema } from "@/lib/validators";

export type ActionResult = { ok?: boolean; error?: string };

export async function getSession() {
  const h = await headers();
  return auth.api.getSession({ headers: h });
}

export async function signUpAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  await auth.api.signUpEmail({ body: parsed.data });
  return { ok: true };
}

export async function signInAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const result = await auth.api.signInEmail({ body: parsed.data });
  if (!result) return { error: "Credenciais inválidas" };
  return { ok: true };
}

export async function forgotPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  await auth.api.requestPasswordReset({ body: { email: parsed.data.email } });
  return { ok: true };
}
```

> Se a versão do Next exigir, ajuste o uso de `headers()`/`cookies()` (promessas) conforme a API vigente.

- [ ] **Step 3: Criar o login form + página**

`src/app/(auth)/login/login-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "@/presentation/actions/auth-actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, { ok: false } as { ok?: boolean; error?: string });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse sua conta no Leiloeiro Nerd</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-emerald-600"><a className="underline" href="/dashboard">Entrar no painel</a></p> : null}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <Button type="submit" disabled={pending}>Entrar</Button>
          <p className="text-sm text-muted-foreground">
            Não tem conta? <a className="text-primary underline" href="/register">Cadastre-se</a> ·{" "}
            <a className="text-primary underline" href="/forgot-password">Esqueci a senha</a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

> O form usa `name` atributos; o `FormData` gerado é convertido e validado com Zod dentro da action.

`src/app/(auth)/login/page.tsx`:

```tsx
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 4: Criar register**

`src/app/(auth)/register/register-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpAction } from "@/presentation/actions/auth-actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState(signUpAction, { ok: false } as { ok?: boolean; error?: string });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Cadastre-se como arrematante (você poderá vender depois)</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-emerald-600"><a className="underline" href="/dashboard">Conta criada — entrar no painel</a></p> : null}
          <div className="space-y-2">
            <Label htmlFor="name">Nome / Nick</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <Button type="submit" disabled={pending}>Criar conta</Button>
          <p className="text-sm text-muted-foreground">
            Já tem conta? <a className="text-primary underline" href="/login">Entrar</a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

`src/app/(auth)/register/page.tsx`:

```tsx
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <RegisterForm />
    </main>
  );
}
```

- [ ] **Step 5: Criar forgot-password**

`src/app/(auth)/forgot-password/forgot-password-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordAction } from "@/presentation/actions/auth-actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, { ok: false } as { ok?: boolean; error?: string });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Recuperar senha</CardTitle>
        <CardDescription>Informe seu e-mail para receber as instruções</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-emerald-600">Enviamos as instruções para seu e-mail.</p> : null}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <Button type="submit" disabled={pending}>Enviar instruções</Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

`src/app/(auth)/forgot-password/page.tsx`:

```tsx
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <ForgotPasswordForm />
    </main>
  );
}
```

> No fluxo de reset, o link é logado no console pelo `emailSender` placeholder (Task 6) enquanto não há Resend.

- [ ] **Step 6: Dashboard layout protegido**

`src/app/(dashboard)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <main className="mx-auto max-w-5xl p-6">{children}</main>;
}
```

`src/app/(dashboard)/dashboard/page.tsx`:

```tsx
import { getSession } from "@/presentation/actions/auth-actions";

export default async function DashboardPage() {
  const session = await getSession();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">
        Olá, {session?.user.name} · {session?.user.email} · Papel: {session?.user.role}
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Proxy de proteção do /dashboard**

`src/proxy.ts`:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (!request.cookies.has("better-auth.session_token") && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/dashboard/:path*",
};
```

> Verificação real da sessão é feita no layout (Step 6); o proxy é só um guard de performance. Se o cookie de sessão tiver outro nome na sua versão do Better Auth, ajuste a string.

- [ ] **Step 8: Verificar o fluxo completo**

Com `pnpm dev`:
1. `http://localhost:3000/dashboard` deslogado → redireciona para `/login`.
2. `http://localhost:3000/register` → cadastrar usuário `Teste Nerd`/`teste@leiloeiro.test`/`senha12345` → aterrissa (pode logar) em `/dashboard`.
3. `/login` → entra com as credenciais → `/dashboard` mostra nome, e-mail e papel `bidder`.
4. Se sessão expirar/logout → volta para `/login`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: páginas de auth, dashboard protegido e proxy /dashboard"
```

---

### Task 8: Use case updateProfile (TDD), repositório e seção de perfil

**Files:**
- Create: `src/domain/repositories/user-repository.ts`
- Create: `src/application/use-cases/update-profile.ts`
- Test: `src/application/use-cases/update-profile.test.ts`
- Create: `src/infrastructure/database/repositories/drizzle-user-repository.ts`
- Create: `src/presentation/actions/profile-actions.ts`
- Create: `src/app/(dashboard)/settings/` (page + form)
- Modify: `src/app/(dashboard)/dashboard/page.tsx` (link p/ `settings`)

**Interfaces:**
- Consumes: Task 6 (`db` tipado), Task 7 (`getSession`).
- Produces:
  - `UserRepository` (domínio): `updateProfile(userId, input): Promise<UserProfile>`; `findBySlug(slug): Promise<{ id; name; slug } | null>`; tipos `UpdateProfileInput`, `UserProfile`.
  - `updateProfile(repo, userId, input): Promise<UserProfile>` — valida slug via `createSlug`.
  - `drizzleUserRepository: UserRepository`.
  - `updateProfileAction(prev, formData)` → `{ ok: true }` ou `{ error: string }`.

- [ ] **Step 1: Definir o contrato do repositório**

`src/domain/repositories/user-repository.ts`:

```ts
export type UserRole = "seller" | "bidder" | "both";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  slug: string | null;
  address: string | null;
  role: UserRole;
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
  slug?: string;
  address?: string;
}

export interface UserRepository {
  updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile>;
  findBySlug(slug: string): Promise<{ id: string; name: string; slug: string } | null>;
}
```

- [ ] **Step 2: Escrever o teste do use case (red)**

`src/application/use-cases/update-profile.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { updateProfile } from "./update-profile";
import type { UpdateProfileInput, UserProfile, UserRepository } from "@/domain/repositories/user-repository";

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
  calls: UpdateProfileInput[] = [];
  async updateProfile(_: string, input: UpdateProfileInput): Promise<UserProfile> {
    this.calls.push(input);
    return { ...baseUser, ...input };
  }
  async findBySlug() {
    return null;
  }
}

describe("updateProfile", () => {
  it("normaliza o slug antes de persistir", async () => {
    const repo = new FakeUserRepository();
    await updateProfile(repo, "u1", { slug: "Loja do Nerd" });
    expect(repo.calls[0]!.slug).toBe("loja-do-nerd");
  });

  it("persiste os campos informados", async () => {
    const repo = new FakeUserRepository();
    const result = await updateProfile(repo, "u1", { name: "Ana B.", phone: "+55 11 99999-0000" });
    expect(result.name).toBe("Ana B.");
    expect(result.phone).toBe("+55 11 99999-0000");
  });

  it("rejeita slug inválido", async () => {
    const repo = new FakeUserRepository();
    await expect(updateProfile(repo, "u1", { slug: "!!" })).rejects.toThrow();
    expect(repo.calls).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Rodar e confirmar falha**

```bash
pnpm test -- src/application/use-cases/update-profile.test.ts
```

Esperado: FAIL — módulo `./update-profile` não existe.

- [ ] **Step 4: Implementar o use case**

`src/application/use-cases/update-profile.ts`:

```ts
import { createSlug } from "@/domain/value-objects/slug";
import type { UpdateProfileInput, UserProfile, UserRepository } from "@/domain/repositories/user-repository";

export async function updateProfile(
  repo: UserRepository,
  userId: string,
  input: UpdateProfileInput,
): Promise<UserProfile> {
  const slug = input.slug ? createSlug(input.slug) : input.slug;
  return repo.updateProfile(userId, { ...input, slug });
}
```

- [ ] **Step 5: Rodar e confirmar pass**

```bash
pnpm test -- src/application/use-cases/update-profile.test.ts
```

Esperado: PASS (3 tests).

- [ ] **Step 6: Implementar repositório Drizzle**

`src/infrastructure/database/repositories/drizzle-user-repository.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { user as userTable } from "@/infrastructure/database/auth-schema";
import type { UpdateProfileInput, UserProfile, UserRepository } from "@/domain/repositories/user-repository";

export const drizzleUserRepository: UserRepository = {
  async updateProfile(userId, input) {
    const [row] = await db
      .update(userTable)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
      })
      .where(eq(userTable.id, userId))
      .returning({ id: userTable.id, name: userTable.name, email: userTable.email, phone: userTable.phone, slug: userTable.slug, address: userTable.address, role: userTable.role });
    if (!row) throw new Error("Usuário não encontrado");
    return { ...row, role: row.role as UserProfile["role"] };
  },

  async findBySlug(slug) {
    const [row] = await db
      .select({ id: userTable.id, name: userTable.name, slug: userTable.slug })
      .from(userTable)
      .where(eq(userTable.slug, slug))
      .limit(1);
    if (!row?.slug) return null;
    return row;
  },
};
```

> Ajuste o nome do table importado (`user` ou `users`) conforme o auth-schema gerado.

- [ ] **Step 7: Criar a profile action**

`src/presentation/actions/profile-actions.ts`:

```ts
"use server";

import { z } from "zod";
import { getSession } from "./auth-actions";
import { formToObject } from "@/lib/validators";
import { updateProfile } from "@/application/use-cases/update-profile";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";

export type ProfileActionResult = { ok?: boolean; error?: string };

const profileSchema = z.object({
  name: z.string().min(2, "Nome muito curto").optional(),
  phone: z.string().optional(),
  slug: z.string().optional(),
  address: z.string().optional(),
});

export async function updateProfileAction(_prev: ProfileActionResult | null, formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" };
  const parsed = profileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  await updateProfile(drizzleUserRepository, session.user.id, parsed.data);
  return { ok: true };
}
```

- [ ] **Step 8: Criar página e form de settings**

`src/app/(dashboard)/settings/settings-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "@/presentation/actions/profile-actions";

export function SettingsForm() {
  const [state, action, pending] = useActionState(updateProfileAction, null as { error?: string; ok?: boolean } | null);

  return (
    <form action={action} className="max-w-md space-y-4">
      {state && "error" in state && state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state && state.ok ? <p className="text-sm text-emerald-600">Perfil atualizado.</p> : null}
      <div className="space-y-2">
        <Label htmlFor="name">Nome / Nick</Label>
        <Input id="name" name="name" placeholder="Como você quer aparecer" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Slug da vitrine (se for leiloeiro)</Label>
        <Input id="slug" name="slug" placeholder="nerd-colecionaveis" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Celular</Label>
        <Input id="phone" name="phone" type="tel" placeholder="+55 11 99999-0000" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Endereço (opcional)</Label>
        <Input id="address" name="address" placeholder="Cidade / UF" />
      </div>
      <Button type="submit" disabled={pending}>Salvar</Button>
    </form>
  );
}
```

`src/app/(dashboard)/settings/page.tsx`:

```tsx
import { SettingsForm } from "./settings-form";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <SettingsForm />
    </div>
  );
}
```

- [ ] **Step 9: Adicionar link no dashboard**

Em `src/app/(dashboard)/dashboard/page.tsx`, adicione:

```tsx
<p>
  <a className="text-primary underline" href="/dashboard/settings">Editar perfil</a>
</p>
```

- [ ] **Step 10: Verificar fluxo manual + build**

```bash
pnpm build
pnpm test
```

Depois em `pnpm dev`: logado, acessar `/dashboard/settings`, salvar slug `Loja do Nerd` e conferir `/dashboard` exibindo os dados (sem erro de duplicidade).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: use case updateProfile com TDD, repositório Drizzle e página de settings"
```

---

### Task 9: Worker BullMQ placeholder

**Files:**
- Create: `src/infrastructure/cron/queue.ts`
- Create: `src/infrastructure/cron/worker.ts`
- Modify: `package.json` (script `worker`)

**Interfaces:**
- Consumes: Task 4 (Redis de pé).
- Produces: `auctionQueue(): Queue` (nome `auction-jobs`); worker que consome a fila.

- [ ] **Step 1: Definir a fila**

`src/infrastructure/cron/queue.ts`:

```ts
import { Queue } from "bullmq";

export const AUCTION_QUEUE = "auction-jobs";

export function auctionQueue(): Queue {
  return new Queue(AUCTION_QUEUE, { connection: { url: process.env.REDIS_URL } });
}
```

- [ ] **Step 2: Definir o worker**

`src/infrastructure/cron/worker.ts`:

```ts
import { Worker } from "bullmq";
import { AUCTION_QUEUE } from "./queue";

const worker = new Worker(
  AUCTION_QUEUE,
  async (job) => {
    console.log(`[worker] processando job "${job.name}":`, job.data);
  },
  { connection: { url: process.env.REDIS_URL } },
);

worker.on("ready", () => console.log("[worker] BullMQ worker conectado ao Redis"));
worker.on("failed", (job, err) => console.error(`[worker] falha no job ${job?.id}`, err));

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
```

- [ ] **Step 3: Adicionar script**

Em `package.json`: `"worker": "tsx watch src/infrastructure/cron/worker.ts"`.

(Adicione `tsx` como devDependency se não houver.)

- [ ] **Step 4: Verificar conectividade**

Em um terminal:

```bash
pnpm worker
```

Em outro:

```bash
pnpm dlx tsx -e "import { auctionQueue } from './src/infrastructure/cron/queue'; const q = auctionQueue(); await q.add('smoke', { at: new Date().toISOString() }); process.exit(0);"
```

Esperado: log `[worker] processando job "smoke": { at: ... }` no primeiro terminal.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: fila BullMQ e worker placeholder conectados ao Redis"
```

---

### Task 10: Integração final e Definition of Done

**Files:**
- Verify apenas (nenhuma alteração de código esperada; corrigir divergências se surgirem).

- [ ] **Step 1: Subir infra**

```bash
docker compose up -d
```

- [ ] **Step 2: Migração idempotente e sem diff**

```bash
pnpm db:migrate
pnpm db:generate
git status --short
```

Esperado: `db:migrate` não lança erro; `db:generate` não cria arquivo novo; `git status` limpo.

- [ ] **Step 3: Testes**

```bash
pnpm test
```

Esperado: PASS (9 + 3 = 12 tests).

- [ ] **Step 4: Build**

```bash
pnpm build
```

Esperado: sem erros.

- [ ] **Step 5: Fluxo completo dev + worker**

`pnpm dev` + `pnpm worker` juntos:
1. Registro → login → `/dashboard` (papel `bidder`).
2. `/dashboard/settings` salva perfil.
3. Deslogar/logout → `/dashboard` redireciona para `/login`.
4. Worker logou o job `smoke`.

- [ ] **Step 6: Conferir DoD do spec**

- [ ] `pnpm dev` e `pnpm worker` sobem juntos sem erros
- [ ] Fluxo registro → login → `/dashboard`; deslogado → redirect
- [ ] `pnpm test` verde (Slug, Money, updateProfile)
- [ ] `db:migrate` idempotente; `db:generate` sem diff
- [ ] `pnpm build` sem erros
- [ ] `.env.example` completo; `.env` ignorado

- [ ] **Step 7: Commit final (se houver correções)**

```bash
git add -A
git commit -m "chore: integração final da Fundação"
```