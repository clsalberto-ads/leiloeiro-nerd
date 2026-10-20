# Smoke Test — Pagamentos Mercado Pago (Fase 3)

> Execute com o app rodando (`pnpm dev` + `pnpm worker`) e o banco/Redis de pé
> (`docker compose up -d`). O smoke REAL exige a ação pendente abaixo; os
> passos 1–4 validam tudo o que não depende da MP.

## Pré-requisito (uma vez): criar o App Mercado Pago

1. Entre em `https://www.mercadopago.com.br/developers/panel/app` com a conta
   **da plataforma**
2. "Criar aplicação" → nome "Leiloeiro Nerd" → produto **Payments**
3. Na aba **Credenciais**, copie:
   - `MERCADO_PAGO_CLIENT_ID` (App ID)
   - `MERCADO_PAGO_CLIENT_SECRET`
4. Na aba **Notificações Webhook**, cadastre a URL:
   - produção: `https://SEU-DOMINIO/api/webhooks/mercadopago`
   - desenvolvimento local: exponha a porta 3000 (ngrok/cloudflared) e use
     a URL pública; o webhook não alcança `localhost` sem isso
5. Preencha no `.env`:
   ```
   MERCADO_PAGO_CLIENT_ID=...
   MERCADO_PAGO_CLIENT_SECRET=...
   MERCADO_PAGO_REDIRECT_URI=http://localhost:3000/api/mercadopago/callback
   ```
6. Crie um **usuário de teste vendedor** no painel (Credenciais → Contas de
   teste) — o OAuth e o PIX do smoke rodam com a conta de TESTE do vendedor,
   não com a conta real dele.

## 1. Conexão OAuth do vendedor (conta de TESTE)

1. Como um usuário com papel de leiloeiro, abra `/dashboard/settings`
2. Clique **"Conectar conta Mercado Pago"**
3. Entre com o usuário de teste vendedor e autorize
4. Volta para as configurações com ✅ "Conectada desde ..." e um flash verde
   - Se vier "erro-troca": confira `CLIENT_ID/SECRET` e a `redirect_uri`
     cadastrada no painel (precisa bater com `MERCADO_PAGO_REDIRECT_URI`)
5. No banco: `select user_id, mp_user_id from mp_seller_accounts;` → 1 linha,
   com tokens gravados

## 2. Criar o leilão e arrematar

1. O vendedor publica um item (ex.: lance mínimo R$ 10,00, incremento R$ 1,00)
2. Um arrematante (outra conta) dá um lance
3. Force o encerramento no banco:
   ```sql
   update items set bid_deadline = now() - interval '1 minute' where id = '...';
   ```
4. Aguarde ≤ 1 min o worker OU rode o job na mão (requisição BullMQ). Logs
   esperados: `[worker] 1 item(ns) expirado(s) encerrado(s)` e nenhuma linha
   de "falha ao gerar cobranca"

## 3. Cobrança PIX na conta do vendedor

1. `select mp_paymentId, amount, platform_fee_cents, seller_net_cents, status
   from payments;` → 1 linha `pending`, com
   `platform_fee_cents = amount * 5%` (R$ 10,00 → 500 / 950)
2. O arrematante tem uma notificação **"Você arrematou um item!"** apontando
   para `/dashboard/payments/{id}`
3. Na página do pagamento: QR Code visível, "Copiar" copia o código PIX,
   countdown conta o prazo de 3 dias

## 4. Aprovação (webhook OU sincronização)

**Via webhook (produção):** pague o PIX com a carteira de teste e observe o
evento chegar em `/api/webhooks/mercadopago`. Item → `paid`, notificação
"Pagamento confirmado!", página para de pollar sozinha.

**Sem webhook (local):** aguarde 15 min o `sincronizar-mp` OU simule a
aprovação chamando o handler pela mesma porta que o worker usa (a ação do
webhook é a mesma). Depois:

```sql
-- status esperado: payment approved, item paid
select p.status as payment, i.status as item
from payments p join items i on i.id = p.item_id;
```

## 5. Cascata de adimplência

1. Force o vencimento: `update payments set deadline = now() - interval '1
   minute' where id = '...';`
2. Aguarde ≤ 10 min o `verificar-prazos` (ou rode o job)
3. O pagamento vira `expired`; o segundo colocado ganha cobrança nova
   (tentativa 2, taxa de 5% de novo, prazo de 24h) com notificação
   **"Você foi chamado para pagar um item!"**
4. Esvaziando os lances: vence também → item `cancelled` + notificação
   "Prazo de pagamento vencido" ao último acionado

## 6. Idempotência (repetir tudo)

Rode o worker por mais um ciclo com os mesmos dados: **nenhum** pagamento
duplicado, nenhuma notificação extra, nenhum item muda de estado. É o que os
testes travam (898) — o smoke confirma no mundo real.

## Checklist de definição de pronto (spec §7)

- [x] Migration `cascadeDeadlineDays` (Fase A, 0006) + `reminder_sent_at` (F, 0007)
- [x] `createPayment` + action + testes (Fases B/C)
- [x] Webhook MP funcional (approved/cancelled) + idempotência (Fase D)
- [x] `getPaymentStatusAction` + polling 10s (Fase C)
- [x] Página `/dashboard/payments/[id]` (QR + countdown + polling)
- [x] 3 jobs BullMQ registrados (encerramento/prazos/sincronização)
- [x] Cascata funcional (expired → próximo → nova cobrança + notificação)
- [x] 5 templates (outbid existente + 4 novos) + in-app
- [x] 898 testes passando, build OK, lint OK
- [ ] Smoke manual completo (este roteiro — depende do App MP)
