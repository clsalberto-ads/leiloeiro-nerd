# Leiloeiro Nerd — Sub-Projeto 1: Fundação (Design)

**Data:** 2026-09-13
**Base:** `docs/project.md` (plano de projeto)
**Caminho do skill:** Brainstorming → spec desta fase → `writing-plans`

---

## 1. Contexto e Objetivo

Leiloeiro Nerd é uma plataforma web de leilões onde leiloeiros expõem peças/serviços e arrematantes dão lances. O projeto completo foi decomposto em 4 sub-projetos (Fundação, Core do Leilão, Pagamentos/Automação, Refinamento) aprovados em brainstorming. Este spec cobre **apenas o sub-projeto 1 (Fundação)**, que estabelece a base técnica sobre a qual as demais fases constroem.

Objetivo da Fundação: projeto Next.js 16 rodando em Docker Compose (PostgreSQL + Redis), schema Drizzle completo e migração inicial, autenticação Better Auth funcional (registro/login/recuperação), shell de dashboard protegido, arquitetura em camadas esboçada, worker BullMQ placeholder e Vitest configurado.

---

## 2. Decisões Transversais (fechadas em brainstorming)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Decomposição | Os 4 sub-projetos do doc; execução sequencial, cada um com spec + plano |
| 2 | Clean Architecture | **Pragmática em camadas**: use cases como funções puras com DI, não classes |
| 3 | Cron/Jobs | **Redis + BullMQ** (worker de longa duração), conforme seções 2/13 do doc |
| 4 | Deploy | **Self-host via Docker Compose** (mesma infra local e produção) |
| 5 | Scope do schema | **Schema Drizzle completo** definido já na Fundação (5 tabelas) |

---

## 3. Stack e Versões

| Camada | Tecnologia | Versão/Pin |
|---|---|---|
| Runtime | Node.js | ^24 (LTS), `engines` no package.json |
| Framework | Next.js | 16.x (App Router, Turbopack default, App Router por padrão) |
| Linguagem | TypeScript | strict mode (>=5.1) |
| Estilização | Tailwind CSS v4 + shadcn/ui | setup via `shadcn init` |
| Package manager | pnpm | — |
| Banco | PostgreSQL 17 | container Docker |
| ORM | Drizzle ORM | `drizzle-orm/node-postgres` + `drizzle-kit` |
| Auth | Better Auth | adapter `@better-auth/drizzle-adapter` |
| Fila | Redis 7 + BullMQ | container Docker |
| Testes | Vitest | configurado nesta fase (TDD nas próximas) |

---

## 4. Infraestrutura (Docker Compose)

`docker-compose.yml` na raiz com dois serviços + redes de aplicação:

- **db**: `postgres:17`, env `POSTGRES_USER/PASSWORD/DB`, healthcheck `pg_isready`, volume nomeado para persistência, porta exposta (ex.: 5432) para tooling local.
- **redis**: `redis:7-alpine`, healthcheck `redis-cli ping`, volume nomeado.

**Regra:** a mesma compose serve dev e produção (self-host). Próximas fases adicionam os serviços `web` (Next) e `worker` (BullMQ consumer) baseados na mesma imagem.

Variáveis (`.env.example`, `.env` ignorado pelo git):
`DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, placeholders `MERCADO_PAGO_*` e `RESEND_*` (ativas a partir da fase 3).

Scripts (`package.json`):
- `dev` → `next dev`
- `worker` → `tsx watch src/infrastructure/cron/worker.ts`
- `db:generate`, `db:migrate`, `db:push` (drizzle-kit)
- `auth:generate` → `npx @better-auth/cli generate`
- `test` → `vitest`
- `build` → `next build`

---

## 5. Estrutura de Diretórios (Clean Architecture Pragmática)

```
src/
├── domain/
│   ├── entities/            # entidades puras (user, item, bid, payment, notification)
│   ├── value-objects/       # money, slug, bid-increment
│   └── repositories/        # interfaces de contrato (user, item, bid, payment, notification)
├── application/
│   ├── use-cases/           # funções puras com deps injetadas
│   └── dtos/                # DTOs de entrada/saída
├── infrastructure/
│   ├── database/
│   │   ├── schema.ts        # tabelas do app (inclui users estendida)
│   │   ├── auth-schema.ts   # GERADO pelo Better Auth (user/session/account/verification)
│   │   ├── drizzle.ts       # client node-postgres (Pool)
│   │   └── repositories/    # implementações Drizzle
│   ├── auth/better-auth.ts  # instância auth
│   ├── payments/            # placeholder (fase 3)
│   ├── email/               # placeholder (fase 3)
│   └── cron/worker.ts       # consumer BullMQ placeholder
├── presentation/
│   ├── app/                 # (public), (auth), (dashboard), api, proxy
│   ├── components/          # ui (shadcn), layout
│   └── actions/             # server actions
└── lib/                     # utils, constants, validators (zod)
```

- **Use case = função pura**, recebe repositórios/interfaces como parâmetros; sem import de infra.
- **Server action = orquestrador fino** que monta as deps concretas e chama o use case.
- Não duplicar entidades puramente por "camada": entidades de domínio existem onde regra de negócio existe; infra mapeia para o schema Drizzle.

---

## 6. Schema Drizzle (Completo)

`src/infrastructure/database/schema.ts` contém **todas** as tabelas aplicacionais; `auth-schema.ts` é arquivo **separado** gerado pelo CLI do Better Auth e incluído no glob do `drizzle.config.ts` (`schema: ['./src/infrastructure/database/schema.ts', './src/infrastructure/database/auth-schema.ts']`).

Valores monetários sempre `integer` (centavos). Enums via `pgEnum`.

### Tabelas

**users** (definida no app para extensão + apontada ao Better Auth via `additionalFields`):
`id, name, email (unique, not null), emailVerified, image, phone, role (enum seller|bidder|both, default bidder), slug (unique, nullable), address, createdAt, updatedAt`.
> Better Auth requer correspondência: passa `schema: { user: users }` (ou omite `schema:` e usa `db._.fullSchema`) conforme docs atuais; validar na implementação e documentar a forma correta no código.

**items:** `id uuid pk default gen_random_uuid(), sellerId fk→users, title, description, type (enum product|service|piece), imageUrl nullable, minInitialBid, minBidIncrement, bidDeadline, paymentDeadlineDays default 3, status (enum draft|active|closed|awaiting_payment|paid|cancelled) default draft, createdAt, updatedAt`.

**bids:** `id uuid pk, itemId fk→items, bidderId fk→users, amount, rank nullable, createdAt`.

**payments:** `id uuid pk, itemId fk→items, bidderId fk→users, bidId fk→bids, amount, mpPaymentId nullable, pixQrCode nullable, pixQrCodeBase64 nullable, paymentLink nullable, status (enum pending|approved|expired|cancelled|refunded) default pending, deadline, attemptNumber default 1, createdAt, updatedAt`.

**notifications:** `id uuid pk, userId fk→users, type (enum outbid|won|payment_due|payment_expired|payment_confirmed), title, content, read boolean default false, createdAt`.

Índices recomendados: `items(bidDeadline, status)`; `bids(itemId)`; `payments(itemId)`, `payments(status, deadline)`; `notifications(userId)`.

**Migração inicial** criada com `drizzle-kit generate` e aplicada (`migrate`). Critério: idempotente em banco limpo.

---

## 7. Autenticação (Better Auth)

`src/infrastructure/auth/better-auth.ts`:
- `drizzleAdapter(db, { provider: "pg" })` **omitindo `schema:`** — o adapter usa `db._.fullSchema`, garantindo que as tabelas do `auth-schema.ts` sejam encontradas (abordagem oficial atual; documentar no código). Se, na versão vigente do adapter, houver necessidade de mapeamento explícito, usar `schema: { user: users, session, account, verification }` — validar nas docs e fixar uma única forma no código.
- `emailAndPassword: { enabled: true }`.
- `user.additionalFields`: `role` (enum string, default `bidder`), `slug` (string, unique, nullable), `phone`, `address`.
- `BETTER_AUTH_SECRET` da env; URL base `BETTER_AUTH_URL`.

Rotas:
- `presentation/app/api/auth/[...all]/route.ts` → handler do Better Auth.
- `presentation/app/(auth)/login`, `/(auth)/register`, `/(auth)/forgot-password` → formulários shadcn (client components) + server actions em `lib/actions/auth-actions.ts` (`signIn.email`, `signUp.email`, `requestPasswordReset`).
- **Verificação de e-mail NÃO é ativada na fase 1** (o campo `emailVerified` existirá no schema, mas segue `false`). Será habilitada na fase de refinamento junto com os e-mails via Resend.
- Proteção do `(dashboard)` via **proxy** (convenção Next 16 substitui middleware) verificando sessão e redirecionando não autenticados.

---

## 8. Entregáveis do Sub-Projeto 1

1. Repositório inicializado (git já existente), `pnpm install`, `.env` funcional.
2. `docker compose up` → Postgres + Redis saudáveis (healthcheck).
3. Migração inicial gerada/aplicada com as 5 tabelas.
4. Fluxo registro → login → recuperação de senha operacional.
5. `/dashboard` shell protegido + exibição dos campos adicionais.
6. Arquitetura de pastas criada; `UserRepository` implementado (Drizzle) + use case `updateProfile` (função com DI) + action de perfil.
7. `worker.ts` placeholder: conecta Redis, instancia fila BullMQ e escuta (prova de conectividade).
8. Vitest configurado; testes verdes de `Slug` e `Money` (normalização de slug; centavos ↔ reais sem ponto flutuante).

---

## 9. Fora do Escopo (Fases 2–4)

CRUD de itens, vitrine pública (`/{slug}`), página de item e lances, upload de imagens, Mercado Pago (PIX/link/webhook), e-mails transacionais reais, jobs de domínio (encerrar leilão, cascata), dashboard completo de leiloeiro/arrematante, SEO, e2e. As tabelas `items/bids/payments/notifications` **são criadas** no schema, mas apenas seu mapeamento Drizzle e repositórios básicos existem; serviços de integração são placeholders.

---

## 10. Critérios de Sucesso / Definition of Done

- `pnpm dev` e `pnpm worker` sobem juntos sem erros (worker ligado ao Redis).
- Fluxo completo: registro → login → `/dashboard` acessível; deslogado → redirect.
- `pnpm test` verde (Slug, Money).
- `db:migrate` aplica em banco limpo e é idempotente; `db:generate` sem diff após a migração inicial.
- `pnpm build` (ou `next build`) sem erros.
- `.env.example` completo; `.env` no `.gitignore`.

---

## 11. Notas para a Implementação (pesquisa confirmada)

- Next.js 16.3.x estável atual; Node >=20.9 obrigatório (usar Node 24 LTS). App Router + Turbopack por padrão; convenção `middleware` renomeada para `proxy`.
- Better Auth: `npx @better-auth/cli generate` produz `auth-schema.ts` separado; **não** mesclar manualmente com `schema.ts` para permitir regeneração sem conflito. `additionalFields` no user exige estender a definição real da tabela `users` no Drizzle (CLI não preserva colunas customizadas — re-adicionar após gerar).
- Drizzle adapter: omitir `schema:` faz o adapter usar `db._.fullSchema` (evita erro `model user not found`); confirmar a forma corrente nas docs oficiais.
- Gerar `BETTER_AUTH_SECRET` com `openssl rand -hex 32`.