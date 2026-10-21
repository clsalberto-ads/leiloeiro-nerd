# Implementação — Sub-projeto Pagamentos e Automação (Fase 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans para implementar este plano task-by-task. Steps usam checkbox (`- [ ]`) syntax.

**Goal:** Integrar pagamentos Mercado Pago (PIX + Payment Link) com webhook assinado, cascata de adimplência configurável, 3 cron jobs BullMQ e 2 templates de email (outbid já existente + `payment_due` novo), com 118+ testes de base.

**Architecture:** Clean Architecture. Server Actions orquestram use cases puros (injeção de repositórios). Job BullMQ `verificar-prazos` (10min) processa a cascata de adimplência; `encerrar-leiloes` (5min) e `sincronizar-mp` (15min) completam a automação. Webhook Mercado Pago com validação assinatura + idempotência por `mpPaymentId`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript strict, Drizzle ORM, BullMQ + Redis, Mercado Pago SDK (`mercadopago`), Resend (emails), Vitest.

**Spec:** docs/superpowers/specs/2026-09-20-leiloeiro-nerd-pagamentos-design.md

## Global Constraints

- pt-BR em toda comunicação (UI, emails, mensagens, logs)
- Valores monetários em **centavos inteiros** no DB; conversão centavos→reais na UI com vírgula (pt-BR: `R$ 1.234,56`)
- TypeScript strict; sem `any`
- Transactional (transações Drizzle) para cascata + webhook; `SELECT FOR UPDATE` onde há corrida
- Webhook: validação assinatura (HMAC-SHA256) + idempotência (`mpPaymentId` UNIQUE) — processou uma vez, nunca reprocessa
- Cascata: default `cascadeDeadlineDays = 3` (24h em spec review ruling; usar `cascadeDeadlineDaysDays` integer nullable default 1 → 24h); rastreamento por `attemptNumber`
- Best-effort notificações: `try/catch` — falha de notificação/email **nunca** falha o lance/pagamento
- Funcionalidade pública (polling de status de pagamento) SEM guard de sessão — página pública
- BullMQ cron jobs: `encerrar-leiloes` (5min), `verificar-prazos` (10min), `sincronizar-mp` (15min)

---

## Estrutura de Arquivos

```
src/
├── domain/
│   ├── repositories/
│   │   ├── bid-repository.ts          [existe — criar+modificar]
│   │   ├── item-repository.ts         [modificar — cascadeDeadline campo]
│   │   ├── payment-repository.ts      [novo]
│   │   └── notification-repository.ts [modificar — tipo cascade]
│   └── value-objects/
│       └── slug.ts                   [existe]
├── application/
│   ├── use-cases/
│   │   ├── encerrar-leiloes.ts        [novo job]
│   │   ├── verificar-prazos.ts        [novo job]
│   │   ├── sincronizar-mp.ts          [novo job]
│   │   ├── create-payment.ts          [novo]
│   │   ├── get-payment-status.ts      [novo]
│   │   └── webhook-mp.ts              [novo]
│   └── validators.ts                  [modificar — add paymentSchema]
├── infrastructure/
│   ├── database/
│   │   ├── schema.ts                  [modificar — payments table existe + índice]
│   │   └── drizzle/
│   │       └── drizzle-payment-repository.ts [novo]
│   ├── email/
│   │   ├── resend.ts                  [existe — add sendPaymentDueEmail]
│   │   └── templates.ts               [existe — add renderPaymentDueEmail]
│   └── bullmq/
│       ├── worker.ts                  [novo]
│       └── cron.ts                   [novo]
└── presentation/
    ├── actions/
    │   └── payment-actions.ts         [novo — createPaymentAction + getPaymentStatusAction + webhook]
    └── app/api/webhooks/mercadopago/route.ts [novo]
```

---

### Task 1: Repositório `PaymentRepository` + tabela payments

**Files:**
- Create: `src/domain/repositories/payment-repository.ts`
- Create: `src/infrastructure/database/drizzle/drizzle-payment-repository.ts`
- Test: `src/domain/repositories/payment-repository.test.ts`

**Interfaces:**
- Produces: `PaymentRepository.createPayment(input) → Promise<Payment>`, `findById`, `findByItemId`, `findByChainIndex`.

- [ ] **Step 1: Teste TDD**

`payment-repository.test.ts` com fake: criar payment grava campos (mpPaymentId, itemId, bidderId, bidId, amount, pixQrCode, pixCopiaECola, paymentLink, status: pending, deadline); fallback se Pix indisponível → paymentLink link.

- [ ] **Step 2: Implementação**

`drizzle-payment-repository.ts` usando `db.insert(payments).values(...).returning()`, `findById`, `findByItemId` (DESC amount), cascade deadlines.

- [ ] **Step 3: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit`

```bash
git add src/domain/repositories/payment-repository.ts src/infrastructure/database/drizzle/drizzle-payment-repository.ts src/domain/repositories/payment-repository.test.ts
git commit -m "feat: PaymentRepository para PIX + Payment Link"
```

---

### Task 2: Use case `create-payment` (TDD)

**Files:**
- Create: `src/application/use-cases/create-payment.ts`
- Create: `src/application/use-cases/create-payment.test.ts`

**Interfaces:**
- Consumes: `PaymentRepository`, `ItemRepository.findById`, `BidRepository.findByItemId`
- Produces: `createPayment(paymentRepo, itemRepo, itemId) → Promise<Payment>`

- [ ] **Step 1: Teste (RED)**

`create-payment.test.ts`: item não encontrado → erro; item sem lances → erro; item com lances ativos → cria payment para rank=1 com deadline default.

- [ ] **Step 2: Implementação (GREEN)**

`create-payment.ts`: valida item existe + tem bidDeadline passado → `findByItemId` → ranks ordenados → `paymentRepo.createPayment({ bidId: bids[0].id, ... })` → retorna payment com qrCode/pix.

- [ ] **Step 3: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit`

```bash
git add src/application/use-cases/create-payment.ts src/application/use-cases/create-payment.test.ts
git commit -m "feat: use case create-payment para vencedor (TDD)"
```

---

### Task 3: Job `encerrar-leiloes` (TDD)

**Files:**
- Create: `src/application/use-cases/encerrar-leiloes.ts`
- Create: `src/application/use-cases/encerrar-leiloes.test.ts`

**Interfaces:**
- Consumes: `ItemRepository`, `BidRepository`, `PaymentRepository` (use case create-payment reusado)
- Produces: `encerrarLeiloes(itemRepo, bidRepo, paymentRepo) → Promise<{ closed: number }>`

- [ ] **Step 1: Teste (RED)**

`encerrar-leiloes.test.ts`: item ativo com bidDeadline passado → status closed + create-payment chamado; item com deadlock futuro → untouched; contagem de fechados.

- [ ] **Step 2: Implementação (GREEN)**

`encerrar-leiloes.ts`: `itemRepo.findByDeadlinePassed({ status: "active" })` → para cada: `itemRepo.setStatus(id, "closed")` → se tem bids: `createPayment(paymentRepo, itemRepo, id)` (best-effort try/catch).

- [ ] **Step 3: Commit**

```bash
git add src/application/use-cases/encerrar-leiloes.ts src/application/use-cases/encerrar-leiloes.test.ts
git commit -m "feat: job encerrar-leiloes com geração de pagamento p/ vencedor"
```

---

### Task 4: Job `verificar-prazos` (cascata — TDD)

**Files:**
- Create: `src/application/use-cases/verificar-prazos.ts`
- Create: `src/application/use-cases/verificar-prazos.test.ts`

**Interfaces:**
- Consumes: `PaymentRepository`, `BidRepository`, `UserRepository`, `NotificationRepository`
- Produces: `verificarPrazos(paymentRepo, bidRepo, userRepo, notifRepo, resendClient) → Promise<{ expired: number; cascaded: number }>`

- [ ] **Step 1: Teste (RED)**

`verificar-prazos.test.ts`: payment pending com deadline passado → status expired + notifica próximo (rank+1) com novo deadline; sem próximo lance → item vira cancelled + notif; lances esgotados → cascata termina.

- [ ] **Step 2: Implementação (GREEN)**

`verificar-prazos.ts`: `paymentRepo.findExpiredPending()` → para cada: set status `expired` → busca próximo bid rank+1 → se existe, `createPayment` com novo attempt + notifica próximo bidder; senão `itemRepo.setStatus(itemId, "cancelled")` + notificação.

- [ ] **Step 3: Commit**

```bash
git add src/application/use-cases/verificar-prazos.ts src/application/use-cases/verificar-prazos.test.ts
git commit -m "feat: job verificar-prazos com cascata de adimplência configurável"
```

---

### Task 5: BullMQ workers + cron jobs

**Files:**
- Create: `src/infrastructure/bullmq/cron.ts` (3 jobs schedulers)
- Create: `src/infrastructure/bullmq/worker.ts` (3 workers bound aos use cases)
- Modify: `docs/project.md` (roadmap Fase 3 checkboxes)

**Interfaces:**
- Consumes: `encerrarLeiloes`, `verificarPrazos`, `sincronizarMp`
- Produces: `startCron()` e `registerWorkers()` usados no instrumento

- [ ] **Step 1: Schedulers**

`cron.ts`: `Queue` BullMQ `leiloes-cron` com 3 jobs repeatable: `encerrar-leiloes` a cada 5min, `verificar-prazos` a cada 10min, `sincronizar-mp` a cada 15min. `startCron()` upserta se não existe.

- [ ] **Step 2: Workers**

`worker.ts`: `new Worker("leiloes-cron", ...)` com switch por job name → use cases; `sincronizar-mp` → `getPaymentStatus` + atualiza status; logs pt-BR best-effort.

- [ ] **Step 3: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint`

```bash
git add src/infrastructure/bullmq/ docs/project.md
git commit -m "feat: workers BullMQ + crons de encerramento, prazos e sincronização"
```

---

### Task 6: Webhook Mercado Pago + server action

**Files:**
- Create: `src/presentation/app/api/webhooks/mercadopago/route.ts`
- Create: `src/application/use-cases/webhook-mp.ts`
- Create: `src/application/use-cases/webhook-mp.test.ts`
- Create: `src/presentation/actions/payment-actions.ts`
- Modify: `src/lib/validators.ts` (add paymentSchema)

**Interfaces:**
- Consumes: `PaymentRepository`, `ItemRepository`, `NotificationRepository`, assinatura HMAC + idempotência
- Produces: `webhookMpAction(signature, body) → { ok: boolean }`, `createPaymentAction(itemId) → { payment }`, `getPaymentStatusAction(paymentId) → { payment }`

- [ ] **Step 1: Use case webhook (TDD)**

`webhook-mp.test.ts`: assinatura inválida → rejeita 401; evento `payment.approved` → status `approved` + notifica `payment_confirmed`; evento `payment.cancelled` → status `cancelled` + cascata (próximo rank); duplicado `mpPaymentId` → idempotente (não reprocessa).

- [ ] **Step 2: Rota webhook**

`route.ts` com `createRouteHandler` valida assinatura MP (`x-signature`) → `webhookMpAction` → 200; erros → 4xx/5xx com log pt-BR.

- [ ] **Step 3: Server actions + validators**

`payment-actions.ts`: `createPaymentAction` (guard seller/both), `getPaymentStatusAction` (guarda itemId UUID), `webhookMpAction` (assinatura). Validators: `paymentSchema` z.object com amount ≥ 100.

- [ ] **Step 4: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint`

```bash
git add src/presentation/app/api/webhooks/mercadopago/route.ts src/application/use-cases/webhook-mp.ts src/application/use-cases/webhook-mp.test.ts src/presentation/actions/payment-actions.ts src/lib/validators.ts
git commit -m "feat: webhook Mercado Pago com assinatura + idempotência + actions de pagamento"
```

---

### Task 7: Template email `payment_due` + integração Resend

**Files:**
- Create: `src/infrastructure/email/templates.ts` (add renderPaymentDueEmail)
- Modify: `src/infrastructure/email/resend.ts` (add sendPaymentDueEmail)
- Modify: `src/application/use-cases/crear-payment.ts` (dispara sendPaymentDueEmail best-effort)

**Interfaces:**
- Produces: `sendPaymentDueEmail(resend, to, { bidderName, itemTitle, amount, paymentUrl })`

- [ ] **Step 1: Template + client**

`templates.ts` add `renderPaymentDueEmail(data)` com pt-BR (vírgula, R$). `resend.ts` add `sendPaymentDueEmail` via Resend.

- [ ] **Step 2: Integração**

`create-payment.ts`: após criar payment, `await sendPaymentDueEmail(...)` dentro try/catch (best-effort) + notificação in-app.

- [ ] **Step 3: Verificação + commit**

Run: `pnpm test && npx tsc --noEmit && pnpm lint`

```bash
git add src/infrastructure/email/ docs/superpowers/specs/2026-09-20-leiloeiro-nerd-pagamentos-design.md
git commit -m "feat: template payment_due + integração Resend no fluxo de pagamento"
```

---

### Task 8: Testes integração + verificação final

**Files:**
- Test: `src/presentation/actions/payment-actions.test.ts` (webhook → approved → status; webhook expired → cascata)
- Test: `src/application/use-cases/verificar-prazos.test.ts` (cascata 2º → 3º → esgotado → cancelled)
- Modify: `docs/project.md` roadmap

**Verification:**
- [ ] **Step 1: Suite completa**

Run: `pnpm test && npx next typegen && npx tsc --noEmit && pnpm lint && pnpm build` — Expected: PASS

- [ ] **Step 2: Smoke manual**

`pnpm dev` → criar item → publicar → dar lance → encerrar (via SQL `UPDATE items SET bid_deadline = now() - interval '1 minute' WHERE...`) → rodar job encerrar-leiloes → verificar payment criado no DB → simular webhook `payment.approved` com assinatura → status approved + notificação.

- [ ] **Step 3: Docs + commit final**

```bash
git add docs/project.md
git commit -m "docs: atualiza roadmap pós sub-projeto pagamentos"
```

---

## Checklist de Cobertura do Spec

| Spec Section | Tasks |
|--------------|-------|
| PaymentRepository.createPayment + findByItemId | Task 1 |
| Use case create-payment (rank=1, deadline default) | Task 2 |
| Cron encerrar-leiloes (5min) + gera payment | Task 3 |
| Cascata verificar-prazos (10min) + configurável | Task 4 |
| BullMQ jobs (3) + workers | Task 5 |
| Webhook MP assinado + idempotência + actions | Task 6 |
| Template payment_due + Resend | Task 7 |
| Testes integração + verificação final | Task 8 |
