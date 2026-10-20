# Plano de Refatoração — Leiloeiro Nerd

> Análise completa do projeto após a Fase 3 (pagamentos). Cada item tem:
> **achado** (o que está errado hoje, com evidência), **solução** e o
> **passo** proposto (pequeno, verificável). Prioridades: **P0** = correto/
> seguro, **P1** = profissional, **P2** = polimento. Esforço: S (< 0,5d), M (~1d), L (2d+).

---

## R1 — Clean Architecture & Design Patterns

### R1.1 · `src/lib` virou um segundo domínio (P0 · M)
**Achado**: regras de negócio moram em `lib/`: `platform-fee.ts` (A TAXA de
marketplace!), `validators.ts` (schemas Zod de domínio), `email-templates.ts`
(html de produto), `timezone.ts` (fuso do produto). `lib` deveria ser só
folha utilitária (`format-brl`, `uuid`, `first-value`).
**Solução**: mover — `platform-fee` → `src/domain/value-objects/fee.ts`;
`validators` → `src/domain/validation/`; `timezone` → `src/domain/`;
templates de e-mail → `src/infrastructure/email/` (já é infra de IO).
**Passo**: R1.1a mover + ajustar imports; R1.1b ver apelidos de barrel p/ não
quebrar 40+ arquivos de teste de uma vez.

### R1.2 · Interface dupla de e-mail (P1 · S)
**Achado**: `ResendClient` (place-bid.ts) e `TransactionalEmailClient`
(email-client.ts) — mesma forma, dois nomes.
**Solução**: um tipo só em `src/lib/email-client.ts`; place-bid importa.

### R1.3 · `ItemRepository` pia-de-louça (P1 · M)
**Achado**: 11 métodos — CRUD + imagens + status + `closeExpired` + contagem
de lances. O projeto JÁ separa portas (`ItemLister`, `ExploreLister`,
`ItemBatchFinder`) mas não terminou.
**Solução**: extrair `ItemImageRepository` (as 4 operações de imagem);
`closeExpired` vira porta `AuctionCloser` do worker. Fakes param de crescer.

### R1.4 · Composição de dependências inconsistente (P1 · S)
**Achado**: `createPaymentDeps()` centraliza (bom), mas bid/item/favorite/
notification actions montam repos na mão, cada uma do seu jeito.
**Solução**: um composition-root por feature em `src/infrastructure/<feature>/
deps.ts`, seguindo o padrão que já existe em payments.

### R1.5 · Strategy para métodos de pagamento (P1 · M) — pré-requisito do R6.1
**Achado**: PIX é o único método, hard-coded no `MpPaymentClient` e no
`createPayment`. Adicionar Checkout Pro exigirá ifs espalhados.
**Solução**: porta `PaymentMethod` (`createCharge(input) → ChargeData`) com
duas implementações (Pix, CheckoutLink); `createPayment` escolhe por
configuração/retorno-fallback.

### R1.6 · Registry de jobs no worker (P2 · S)
**Achado**: dispatch por cadeia de `if (job.name === ...)` — cada job novo
edita o mesmo bloco.
**Solução**: `const JOBS = { [VERIFICAR_PRAZOS_JOB]: { every, run } }` e um
loop no scheduler/handler.

### R1.7 · Fakes de pagamento triplicadas (P2 · M)
**Achado**: `FakePaymentRepo` (~90 linhas) reescrita em 4 arquivos de teste.
**Solução**: `src/test/fakes/payment-repository.ts` compartilhado (padrão
de fixture); testes importam e configuram overrides.

---

## R2 — Frontend, layout e shadcn/ui

### R2.1 · `<main>` aninhado em 10 páginas (P0 · M)
**Achado**: cada página do dashboard renderiza `<main class="min-h-screen
...">` DENTRO do `<main>` do layout — semanticidade quebrada (2 landmarks
main), padding dobrado, `min-h-screen` conflitando com o header sticky.
**Solução**: o layout é o dono do shell (`<main>` único); páginas renderizam
só conteúdo. Remove os 10 wrappers.

### R2.2 · `PageContainer` existe e ninguém usa (P1 · S)
**Achado**: `components/layout/page-container.tsx` usado em 2 lugares; as
páginas recriam containers à mão com larguras diferentes (max-w-6xl / 3xl /
nenhuma).
**Solução**: padronizar via `PageContainer` com variantes
`size="wide|content|form"`; largura deixa de ser decisão de cada página.

### R2.3 · 6 `<img>` cru com eslint-disable (P1 · S)
**Achado**: `no-img-element` desligado ad hoc em 6 arquivos (vitrine, item
form, chat, hero).
**Solução**: configurar `images.remotePatterns` (uploadthing + domínios de
CDN) no `next.config.ts` e migrar para `next/image` (laziiness + dimensões).
Para o QR do MP (data URL), `<Image unoptimized>` ou manter `<img>` num
único componente `QrCode` central.

### R2.4 · 7 botões manuais fora do DS (P1 · S)
**Achado**: `inline-flex h-7/h-8...` escritos à mão (paginação de
notificações, filtros, "Voltar ao dashboard" do my-bids) — divergem de hover/
foco/disabled do `Button`.
**Solução**: trocar por `<Button variant size>`; junto, usar o componente
`Pagination` do shadcn na página de notificações.

### R2.5 · Feedback inconsistente: toast × alert inline (P1 · M)
**Achado**: só 3 arquivos usam `toast`; settings usa `<p>` inline; itens
(publicar/cancelar) não avisam nada (só mudam de página).
**Solução**: convenção — toda action com resultado visível imediato usa
toast (sonner); erros de formulário continuam inline (`role="alert"`) +
`aria-live`. Adicionar toasts de confirmação nas ações de linha da tabela.

### R2.6 · `loading.tsx` ausente em todo o dashboard (P1 · S)
**Achado**: nenhuma rota do dashboard tem skeleton (`components/skeletons.tsx`
existe para a vitrine); navegar entre rotas força um vazio branco.
**Solução**: `loading.tsx` por grupo com os skeletons existentes
(`TableSkeleton`/`ItemCardSkeleton`).

### R2.7 · Página de notificações fora do DS (P1 · M)
**Achado**: filtros são `<Link>` crus, paginação manual com
`pointer-events-none`, sem badge de contador, sem DataTable.
**Solução**: re-vestir com `Tabs` (status), `Badge` (não lidas por filtro),
`Pagination` + estado vazio do shadcn `Empty`.

### R2.8 · Charts: config defensiva e cores duplicadas (P2 · S)
**Achado**: `items-by-status-chart` monta config com `Object.fromEntries` +
`STATUS_LABELS && ...` (defensivo desnecessário) e `TONES` repete o mapeamento
de cores que o CSS já tem (`--chart-N`).
**Solução**: `ChartConfig` gerado do `STATUS_LABELS` + array de tons em um
só lugar; simplificar a montagem.

---

## R3 — UX / IHC / Usabilidade

### R3.1 · Countdown do pagamento diz "Encerrado" (P0 · S)
**Achado**: `PaymentView` reusa `BidCountdown`, cuja palavra final é
"Encerrado" — para pagamento o termo é **"Vencido"**.
**Solução**: prop `expiredLabel` no `BidCountdown` (default "Encerrado").

### R3.2 · Alvos de toque < 44px (P1 · S)
**Achado**: botões `icon-sm` (28px) e h-7 (28px) em áreas de ação primária.
**Solução**: teto de 40–44px em controles de toque (regra de thumb da Apple/
Material); `icon-sm` restrito a ações dentro de linhas de tabela (mouse).

### R3.3 · Página de detalhe sem caminho de volta (P1 · S)
**Achado**: `/[slug]/[itemId]` não tem breadcrumb nem "voltar à vitrine".
**Solução**: breadcrumb simples `Vitrine / {item.title}` + link de retorno.

### R3.4 · Explore sem busca nem paginação (P1 · M) — ver R7.2
### R3.5 · "My bids" não mostra estado do pagamento (P1 · M) — ver R7.3
### R3.6 · Formulário de configurações sem validação client (P2 · S)
**Achado**: settings-form valida só no servidor (zod), sem feedback de campo.
**Solução**: mesmo desenho do register (react-hook-form + zodResolver).

### R3.7 · Hierarquia do dashboard de vendedor (P2 · M)
**Achado**: 4 indicadores iguais; "Valor listado" é conceito confuso
(abertura ≠ receita). KPIs monetários (`getDashboardMonetaryKPIs`) existem e
não são exibidos — a TAXA de 5% é invisível para o vendedor.
**Solução**: cards com hierarquia (destaque líquido + secundários),
incluindo "Receita líquida" e "Taxa da plataforma (5%)" lendo o LEDGER
(`platform_fee_cents`) — transparência da taxa vira recurso de confiança.

---

## R4 — Inconsistências gerais

- **R4.1** (P2 · S): `docs/superpowers/plans` descrevem estrutura antiga
  (drizzle em `src/infrastructure/drizzle/`), só valor histórico — mover para
  `docs/history/` com um README de aviso.
- **R4.2** (P2 · S): `src/domain/chat/` e `src/domain/rag/` usam pasta
  `types/` enquanto o resto do domínio usa `repositories/` para tipos —
  padronizar `src/domain/<contexto>/`.
- **R4.3** (P1 · S): branches locais/remotas já mescladas (`feature/*`,
  `refactor/i18n-code-en`) — deletar (higiene); `REFACTOR-I18N-PLAN.md`
  concluído → mover para history junto (R4.1).
- **R4.4** (P0 · S): `REFACTOR-I18N` diz "concluído", mas o plano atual de
  comentários está em pt-BR ✅ — apenas arquivar (sem ação de código).

---

## R5 — Segurança

### R5.1 · Token MP em texto puro no banco (P0 · M)
**Achado**: `mp_seller_accounts.accessToken` é `text` limpo — dump do banco
vaza acesso à conta financeira do vendedor.
**Solução**: criptografia em repouso AES-256-GCM com chave dedicada
(`MP_TOKEN_ENCRYPTION_KEY`, 32 bytes, no .env — NÃO derivada do
BETTER_AUTH_SECRET para permitir rotação isolada); cifra na escrita, decifra
na leitura, no repositório Drizzle (as camadas acima nem ficam sabendo).
Tabelas de teste: comando único de re-conexão (vendedor reconecta).

### R5.2 · Rate limit in-memory não serve multi-instância (P1 · M)
**Achado**: `rate-limit.ts` é um Map por processo — PM2 cluster ou 2 réplicas
= limite dobrado/triplicado; webhook e chat desprotegidos na prática.
**Solução**: mesma interface, backend Redis (INCR + EXPIRE — o Redis do
BullMQ já existe); fallback in-memory se Redis indisponível.

### R5.3 · Headers de segurança ausentes (P1 · S)
**Achado**: nenhum header HTTP (CSP, HSTS, X-Frame-Options, Referrer-Policy).
**Solução**: bloco `headers()` no `next.config.ts` + `poweredByHeader: false`
+ CSP com nonce via proxy (avaliar peso de CSP estrita vs inline styles do
Tailwind — começar com headers conservadores).

### R5.4 · Sync MP depende só do token do vendedor (P1 · S)
**Achado**: `sincronizar-mp`/webhook consultam com o token do vendedor; se
ele DESCONECTAR a conta, pagamentos pendentes ficam órfãos silenciosos.
**Solução**: fallback para o token da plataforma (`MERCADO_PAGO_ACCESS_TOKEN`)
em leitura; log explícito quando ambos falham; e-mail/aviso ao vendedor
"conecte a conta para receber".

### R5.5 · Segurança já garantida (sem ação, documentar) ✅
Assinatura HMAC timing-safe + anti-replay; state OAuth de uso único; guards
de UUID nas actions; `toActionError` sem vazamento; idempotência atômica.

---

## R6 — Fluxo de pagamento

### R6.1 · Checkout Pro (cartão) ausente — os cartões de teste não podem ser exercitados (P0 · L)
**Achado**: só PIX existe; a coluna `payment_link` está no schema e nunca é
usada. Os cartões de teste (Mastercard/Visa/Amex/Elo) e a matriz APRO/OTHE/
CONT/CALL/FUND/SECU/EXPI/FORM só funcionam via **Checkout Pro** (link).
**Solução**: implementar `CheckoutLink` como segundo método (R1.5):
Preferences API → `init_point`; página ganha botão "Pagar com cartão" ao
lado do PIX; webhook já processa `approved/rejected` ✅.
**Passos**: R6.1a porta PaymentMethod + impl Checkout; R6.1b createPayment
gera AMBOS (PIX + link) e grava o link; R6.1c UI da página com abas
PIX/Cartão; R6.1d smoke com a matriz de cartões (R8).

### R6.2 · Status `awaiting_payment` nunca usado (P1 · S)
**Achado**: item fica `closed` durante a cobrança; o enum tem um estado
para "vencemos, aguardando pagamento" que ninguém transita — e o arrematante
não vê "aguardando pagamento" em lugar nenhum.
**Solução**: `createPayment` (tentativa 1) → item `awaiting_payment`;
webhook approved → `paid`; cascata esgotada → `cancelled`; aba "Aguardando
pagamento" já existe por tabela de status. Ajustar worker (closeExpired →
closed continua; a criação da cobrança move para awaiting_payment) + testes
de transição + tabs/labels.

### R6.3 · KPIs monetários prontos e não exibidos (P1 · S) — ver R3.7.

### R6.4 · Webhook aponta para produção (`https://leiloeironerd.com.br`) (P0 · S — operação)
**Achado**: sem deploy no domínio, o webhook não chega; smoke local exige
túnel. `MERCADO_PAGO_REDIRECT_URI` precisa da URL de PRODUÇÃO no painel MP.
**Solução**: (a) deploy/reverse proxy no domínio já previsto (Fase 4 do
roadmap) OU (b) para validar antes: cloudflared/ngrok + URL temporária no
painel; depois trocar para o domínio definitivo.

---

## R7 — Outros fluxos

### R7.1 · Notificações com caminho em texto puro (P1 · M)
**Achado**: `"/dashboard/payments/{id}"` no `content` — o usuário LÊ o
caminho, não clica.
**Solução**: campo estruturado `notifications.link` (nullable) + UI renderiza
`<Link>` seguro (sem HTML livre); migration + retrocompat com content.

### R7.2 · Explore: paginação + busca (P1 · M) — igual ao dashboard
(items), `ExploreLister` ganha filter/limit/offset.

### R7.3 · My-bids sem badge de pagamento (P1 · M)
**Solução**: porta `findPendingByItemIds` (lote) + coluna "Pagamento" com
badge/link "Pagar" quando pendente; estado "pago/vencido" quando final.

### R7.4 · Fluxo de reembolso inexistente (P2 · M — Fase 4)
`refunded` existe no enum e em nenhuma linha de código. Seller-initiated
refund via API MP + `markRefunded` + transição de item. Deixar planejado.

### R7.5 · Chat: índice RAG por processo (P2 · S)
Múltiplas instâncias = caches divergentes; TTL de recarga (refetch a cada X
min) já resolve sem Redis.

---

## R8 — Teste com cartões de teste (depende do R6.1)

Com Checkout Pro no ar, a matriz de cartões vira o E2E real de TODA a cadeia:

| Holder name | Resultado esperado no app |
|---|---|
| `APRO` | webhook `approved` → payment `approved` + item `paid` + notificação |
| `OTHE`/`SECU`/`FUND`/`EXPI`/`FORM` | webhook `rejected`→`cancelled` → **cascata chama o 2º colocado** (R6.1 + fix do cancelamento) |
| `CONT` (pending) | sincronizar-mp depois decide; lembrete `payment_due` na janela |

Roteiro: smoke do `docs/payments-smoke.md` §4 substituído por pagamento via
link com cada cartão; verificar `platform_fee_cents` **de novo na cascata**
(a taxa de 5% tem que aparecer em TODA cobrança nova).

---

## Ordem sugerida de execução (etapas pequenas por categoria)

1. **R1.1 + R1.2** (mover regras para o domínio; unificar porta de e-mail)
2. **R2.1 + R2.2** (shell único + PageContainer — base de TODO o layout)
3. **R5.1 + R5.3** (criptografar token MP + headers de segurança)
4. **R6.2** (awaiting_payment — muda transições visíveis)
5. **R1.5 + R6.1** (PaymentMethod Strategy + Checkout Pro → destrava R8)
6. **R8** (matriz de cartões — validação E2E real)
7. **R2.3–R2.7** (img/next, botões, toasts, loading, notificações no DS)
8. **R3.x** (labels de countdown, touch targets, breadcrumb, KPIs do vendedor)
9. **R5.2 + R5.4** (rate limit Redis + fallback de sync)
10. **R7.x** (links de notificação, explore, my-bids, plano de reembolso)
11. **R1.3/R1.4/R1.6/R1.7/R4.x** (higiene arquitetural e de repositório)

Cada etapa termina com typecheck + lint + testes + build + commit/push.
