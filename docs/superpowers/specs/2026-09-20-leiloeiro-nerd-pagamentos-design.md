# Spec: Sub-projeto 3 — Pagamentos e Automação (Fase 3)

## 1. Visão Geral

Implementar o sistema de pagamentos e automação do Leiloeiro Nerd: integração com Mercado Pago (PIX + Payment Link), webhook de confirmação, cron jobs BullMQ (encerramento, prazos, sincronização), cascata de lances configurável, página de pagamento com QR Code, notificações transacionais (5 templates), e testes.

## 2. Escopo

### Incluído
- Integração Mercado Pago: PIX (QR Code + copia-e-cola) + Payment Link
- Server Action `createPayment` + `getPaymentStatus` + `cancelPayment`
- Webhook Mercado Pago: `payment.approved`, `payment.cancelled`, `payment.expired` (validação assinatura + idempotência)
- 3 Cron Jobs BullMQ: `encerrar-leiloes` (5min), `verificar-prazos` (10min), `sincronizar-mp` (15min)
- Cascata de lances configurável (default 24h, até esgotar lances válidos)
- Página `/dashboard/payments/[id]`: QR Code, copia-e-cola, link, countdown, polling 10s
- 5 Templates Resend: `outbid` (já existe), `payment_due`, `payment_confirmed`, `payment_expired`, `next_bidder_called` (enum -> §4)
- Testes: unit (placeBid, cascata, webhook), integração (webhook approve/expired → cascata), E2E Playwright

### Excluído (Fase 4)
- Dashboard completo (leiloeiro + arrematante)
- Histórico de lances/pagamentos avançado
- Playwright e2e completo
- SEO/OG, a11y, deploy, monitoring

## 3. Arquitetura

### 3.1 Fluxo de Pagamento

```
Seller cria item → Publica (active) → Arrematante dá lance → Leilão encerra
    ↓
Cron "encerrar-leiloes" detecta bidDeadline ≤ now → status=closed
    ↓
Gera payment para 1º colocado (rank=1): cria payment (mpPaymentId, QR, link, deadline=3d default) → status=pending
    ↓
Arrematante acessa /dashboard/payments/[id] → vê QR Code + copia-e-cola + link + countdown
    ↓
Polling 10s → GET /api/payment-status?mpId=xxx → atualiza UI
    ↓
Webhook MP (payment.approved) → valida assinatura + idempotência (mpPaymentId) → status=approved
    → dispara email payment_confirmed + in-app notification
    → item status=paid
    ↓
Se payment expirado (verificar-prazos cron) → status=expired → CASCATA
    → Próximo rank válido sem payment → cria payment (deadline configurável, default 24h)
    → Notifica next_bidder_called (email + in-app)
    → Repete até esgotar lances válidos
```

### 3.2 Server Actions (src/presentation/actions/payment-actions.ts)

| Action | Input | Output | Auth |
|--------|-------|--------|------|
| `createPayment` | `{ itemId, bidId }` | `{ paymentId, qrCode, pixCopiaCola, paymentLink, deadline }` | Seller (owner do item) |
| `getPaymentStatus` | `{ mpPaymentId }` | `{ status, qrCode, pixCopiaCola, paymentLink, deadline }` | Bidder (owner do payment) |
| `cancelPayment` | `{ paymentId }` | `{ ok: true }` | Bidder (owner) |

### 3.3 Webhook Mercado Pago (`/api/webhooks/mercadopago`)

| Evento | Ação |
|--------|------|
| `payment.approved` | Atualiza payment `status=approved`, `updatedAt=now`; dispara `payment_confirmed` email + in-app |
| `payment.cancelled` | `status=cancelled`; dispara `payment_cancelled` (se aplicável) |
| `payment.expired` | `status=expired`; sincroniza com MP. Cascata **não** é disparada aqui — apenas via cron `verificar-prazos` (evita gatilhos duplicados) |

**Segurança:**
- Validação de assinatura via JWT HMAC-SHA256 (HS256) no header `x-signature` — payload do JWT com claims `id` (mpPaymentId) + `timestamp`; verificar correspondência do claim `id` com o id do body/payload, validar assinatura HS256 e expiração do token (replay) antes de processar
- Idempotência via `mpPaymentId` único (constraint UNIQUE)
- Rate limit: 10 req/s (MP limit)

### 3.4 Cron Jobs BullMQ (Redis)

| Job | Frequência | Lógica |
|-----|------------|--------|
| `encerrar-leiloes` | 5 min | `items` status `active` + `bidDeadline <= now` → `status=closed` + cria `payment` de rank=1 (se houver lances). **Não** dispara cascata |
| `verificar-prazos` | 10 min | **Único gatilho da cascata.** (a) `payments` status `pending` + `deadline <= now` → `status=expired` → dispara cascata (próximo rank, §3.5); (b) `payments` `pending` com `deadline - now <= 24h` → dispara email `payment_due` |
| `sincronizar-mp` | 15 min | `payments` status `pending` + `createdAt > 1h` → GET `/v1/payments/{id}` MP → sync status. **Não** dispara cascata |

**BullMQ Config:**
- Redis: `REDIS_URL` (já configurado)
- Queue names: `encerrar-leiloes`, `verificar-prazos`, `sincronizar-mp`
- Concurrency: 5 (padrão)
- Retry: 3x com backoff exponencial
- Dead letter queue para falhas persistentes

### 3.5 Cascata de Lances (Configurável)

**Regras:**
1. Payment expira (`verificar-prazos` detecta `deadline < now` + status `pending`)
2. Marca `status=expired`
3. Busca próximo `Bid` válido: `rank = payment.attemptNumber + 1` (1-indexed), `bidderId` diferente do anterior, sem `payment` existente
3. Cria novo `Payment` para esse `bidderId`: `attemptNumber = rank`, `deadline = item.paymentDeadlineDays` (configurável, default 24h)
4. Dispara notificação `next_bidder_called` (email + in-app)
5. Repete até esgotar lances válidos (sem `Bid` seguinte) → **status-fim explícito:** item `status=cancelled` — nenhum arrematante validou pagamento; dispara notificação `payment_expired` final (in-app) para o último arrematante acionado

**Configuração por Leilão:**
- `items.paymentDeadlineDays` (já existe, default 3) → prazo inicial
- `items.cascadeDeadlineDays` (novo, nullable, default 24h) → prazo por posição na cascata

### 3.5 Página de Pagamento (`/dashboard/payments/[id]`)

**Componentes:**
- `PaymentQRCode`: QR Code (base64) + botão "Copiar PIX" (copia-e-cola)
- `PaymentLink`: Link Mercado Pago (abre em nova aba)
- `PaymentCountdown`: deadline em tempo real (usa `BidCountdown` existente)
- `PaymentStatusBadge`: `pending`/`approved`/`expired`/`cancelled`
- `PaymentStatusPolling`: polling 10s → `getPaymentStatusAction(mpPaymentId)` → atualiza estado

**Acessibilidade:** ARIA labels no QR Code, contraste AA, foco visível.

### 3.6 Notificações (5 Templates Resend)

| Template | Trigger | Variáveis |
|----------|---------|-----------|
| `outbid` | Lance superado | `bidderName`, `itemTitle`, `oldAmount`, `newAmount`, `itemUrl` |
| `payment_due` | 24h antes do deadline | `bidderName`, `itemTitle`, `amount`, `deadline`, `paymentUrl` |
| `payment_confirmed` | Webhook `approved` | `bidderName`, `itemTitle`, `amount`, `itemUrl` |
| `payment_expired` | Cron `verificar-prazos` detecta expiração | `bidderName`, `itemTitle`, `amount`, `itemUrl` |
| `next_bidder_called` | Cascata ativada | `bidderName`, `itemTitle`, `amount`, `deadline`, `paymentUrl` |

**Formato:** HTML pt-BR, valores em R$ no padrão pt-BR (`formatReais`): ponto separador de milhar e vírgula decimal, ex.: `R$ 1.234,56` (nunca `1,234.56`), link para `/dashboard/payments/[id]`.

**Exemplo de corpo pt-BR — `next_bidder_called`:**
> Assunto: "Você foi chamado para pagar o item **{itemTitle}**"
> "Olá {bidderName}, o arrematante anterior não pagou o item **{itemTitle}** em **R$ {amount}**. Você está na sequência! Acesse {paymentUrl} para pagar até {deadline}."

### 3.7 Segurança

| Camada | Implementação |
|--------|---------------|
| Webhook | Validação de assinatura via JWT HMAC-SHA256 (HS256) no header `x-signature`: claims `id` (mpPaymentId) + `timestamp`; validar assinatura, expiração do token e correspondência do claim `id` com o payload (`mercadopago` SDK) |
| Idempotência | `mpPaymentId` UNIQUE + check-exists antes de processar |
| Transações DB | `createPayment` + `createItemImages` em transação; `placeBid` já corrigido (lock + revalidação) |
| Rate Limit | MP: 10 req/s global; webhook: 100 req/min por IP (middleware Next) |
| Validação | Zod em todas as server actions (`createPaymentSchema`, `cancelPaymentSchema`) |
| Autorização | `createPayment`: seller owner do item; `cancelPayment`: bidder owner do payment |

### 3.8 Testes

| Tipo | Cobertura |
|------|-----------|
| Unit | `createPayment`, `cancelPayment`, `getPaymentStatus`, `cascata`, `webhookHandler`, `formatReais`, `nextRank` |
| Integração | `createPayment` → webhook `approved` → status approved; webhook `expired` → cascata cria próximo payment; cron jobs (mock BullMQ) |
| E2E (Playwright) | Criar item → publicar → dar lance → encerrar → pagamento → webhook approve → status approved; webhook expired → cascata → próximo payment |

## 4. Modelo de Dados (Já existe - validação)

### `payments` (já existe)
```ts
id: uuid PK
itemId: uuid FK → items
bidderId: text FK → user
bidId: uuid FK → bids
amount: integer (centavos)
mpPaymentId: text (UNIQUE, nullable)
pixQrCode: text (nullable)
pixQrCodeBase64: text (nullable)
paymentLink: text (nullable)
status: enum(pending, approved, expired, cancelled, refunded)
deadline: timestamp with tz
attemptNumber: integer (default 1) // rank na cascata
createdAt/updatedAt
```

**Novo campo (opcional):**
```ts
cascadeDeadlineDays: integer("cascade_deadline_days").default(24).nullable() // em items
```

### `notifications` (já existe)
```ts
type: enum(outbid, won, payment_due, payment_expired, payment_confirmed, next_bidder_called, ...)
```

## 5. Roteiro de Implementação (Tasks)

| Task | Descrição | Estimativa |
|------|-----------|------------|
| 1 | Schema: adicionar `cascadeDeadlineDays` em `items` + migração | 0.5d |
| 2 | Mercado Pago SDK + tipos + `createPayment` use case + `createPaymentAction` | 1d |
| 3 | Webhook `/api/webhooks/mercadopago` + validação assinatura + idempotência | 1d |
| 4 | `getPaymentStatus` use case + action + polling 10s page | 0.5d |
| 5 | Página `/dashboard/payments/[id]` (QR, countdown, polling) | 1d |
| 6 | Cron Jobs BullMQ (3 jobs) + workers | 1d |
| 7 | Cascata de lances (use case + action + cron `verificar-prazos`) | 1d |
| 8 | 5 templates Resend + in-app notifications | 0.5d |
| 9 | Testes unit + integração + E2E Playwright | 1.5d |
| 10 | Verificação final + docs | 0.5d |

**Total estimado:** ~8.5 dias

## 6. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Webhook MP não chega / duplicado | Média | Alto | Idempotência por `mpPaymentId` + log + retry BullMQ |
| Race condition no createPayment | Baixa | Alto | Transação + lock (padrão já estabelecido) |
| QR Code expira antes do pagamento | Baixa | Médio | MP QR Code não expira; deadline controlado por nós |
| Cascata infinita / loop | Baixa | Alto | Max `attemptNumber` = total bids; log + alerta |
| Rate limit MP em produção | Média | Médio | BullMQ retry + backoff + dead letter queue |
| QR Code não renderiza no mobile | Baixa | Médio | Testar em device real; fallback copia-e-cola |

## 7. Checklist de Definição de Pronto (DoD)

- [ ] Schema migration aplicada (`cascadeDeadlineDays`)
- [ ] `createPayment` + `createPaymentAction` + testes
- [ ] Webhook MP funcional (aprovado/cancelado/expirado) + idempotência
- [ ] `getPaymentStatusAction` + polling 10s na página
- [ ] Página `/dashboard/payments/[id]` renderiza QR + countdown + polling
- [ ] 3 jobs BullMQ rodando + workers registrados
- [ ] Cascata funcional (expirado → próximo rank → novo payment + notificação)
- [ ] 5 templates Resend + in-app notifications
- [ ] 100% testes passando (unit + integração), build OK, lint OK
- [ ] Smoke manual: criar item → publicar → lance → encerrar → payment → webhook approve → cascata expirado → próximo
- [ ] Docs atualizadas (`docs/project.md` Fase 3 ✅)

---

## 8. Próximos Passos (após aprovação)

1. **Escrever plano de implementação** (`writing-plans` skill) com 10 tasks detalhadas
2. **Executar** via SDD (subagent-driven) com review por task
8. **Smoke manual** completo + merge em main

---

**Aguardando aprovação para escrever o spec e iniciar o plano.**