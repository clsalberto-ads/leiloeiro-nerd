# 🏷️ Leiloeiro Nerd — Plano de Projeto

---

## 1. Visão Geral do Projeto

**Leiloeiro Nerd** é uma plataforma web de leilões onde qualquer pessoa física ou jurídica pode se cadastrar como **leiloeiro** e expor peças, produtos ou serviços para leilão. Interessados (**arrematantes**) podem se cadastrar e dar lances nos itens disponíveis. A plataforma gerencia automaticamente o ciclo de pagamento, notificando o próximo maior lance caso o arrematante vencedor não efetue o pagamento dentro do prazo.

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Observação |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Server Actions, React Server Components |
| **Arquitetura** | Clean Architecture | Separação em camadas: Domain, Application, Infrastructure, Presentation |
| **Linguagem** | TypeScript | Strict mode |
| **Estilização** | Tailwind CSS + Shadcn/UI | Componentes acessíveis e responsivos |
| **Banco de Dados** | PostgreSQL | Docker |
| **ORM** | Drizzle ORM | Schema gerado pelo Better Auth + migrações |
| **Autenticação** | Better Auth | Verificar docs oficiais para plugins e configuração |
| **Pagamentos** | Mercado Pago | QR Code PIX + Links de Pagamento |
| **Filas / Cron** | Redis + Bull | Verificação de prazos e disparo de notificações |
| **E-mail** | Resend | Templates transacionais |

---

## 3. Arquitetura (Clean Architecture)

```
src/
├── domain/                    # Entidades, Value Objects, Interfaces de Repositório
│   ├── entities/
│   │   ├── user.ts
│   │   ├── item.ts
│   │   ├── bid.ts
│   │   └── payment.ts
│   ├── value-objects/
│   │   ├── money.ts
│   │   ├── slug.ts
│   │   └── bid-increment.ts
│   └── repositories/          # Interfaces (contratos)
│       ├── user-repository.ts
│       ├── item-repository.ts
│       ├── bid-repository.ts
│       └── payment-repository.ts
│
├── application/               # Casos de Uso (Use Cases)
│   ├── use-cases/
│   │   ├── create-item.ts
│   │   ├── place-bid.ts
│   │   ├── close-auction.ts
│   │   ├── notify-next-bidder.ts
│   │   ├── process-payment.ts
│   │   └── verify-payment-deadlines.ts
│   └── dtos/
│       ├── create-item-dto.ts
│       ├── place-bid-dto.ts
│       └── register-bidder-dto.ts
│
├── infrastructure/            # Implementações concretas
│   ├── database/
│   │   ├── schema.ts          # Drizzle schema
│   │   ├── drizzle.ts         # Client connection
│   │   └── repositories/      # Implementações dos repositórios
│   │       ├── drizzle-user-repository.ts
│   │       ├── drizzle-item-repository.ts
│   │       ├── drizzle-bid-repository.ts
│   │       └── drizzle-payment-repository.ts
│   ├── auth/
│   │   └── better-auth.ts     # Configuração Better Auth
│   ├── payments/
│   │   └── mercado-pago.ts    # SDK Mercado Pago
│   ├── email/
│   │   └── resend.ts          # Cliente Resend + templates
│   └── cron/
│       └── inngest.ts         # Funções Inngest / Vercel Cron
│
├── presentation/              # Camada de apresentação (Next.js)
│   ├── app/                   # App Router
│   │   ├── (public)/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   └── api/
│   ├── components/
│   │   ├── ui/                # Shadcn/UI
│   │   ├── layout/
│   │   ├── auction/
│   │   └── bid/
│   └── actions/               # Server Actions
│       ├── item-actions.ts
│       ├── bid-actions.ts
│       └── payment-actions.ts
│
└── lib/                       # Utilitários compartilhados
    ├── utils.ts
    ├── constants.ts
    └── validators.ts          # Zod schemas
```

---

## 4. Modelo de Dados (Drizzle ORM Schema)

### 4.1 Tabela `users` (estende Better Auth)

| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | `text` | PK | Gerado pelo Better Auth |
| `name` | `text` | NOT NULL | Nome ou Nick Name |
| `email` | `text` | UNIQUE, NOT NULL | E-mail |
| `emailVerified` | `boolean` | DEFAULT false | Verificação de e-mail |
| `image` | `text` | NULLABLE | Avatar |
| `phone` | `text` | NULLABLE | Celular |
| `role` | `enum('seller','bidder','both')` | DEFAULT 'bidder' | Papel do usuário |
| `slug` | `text` | UNIQUE, NULLABLE | Slug da vitrine (apenas sellers) |
| `address` | `text` | NULLABLE | Endereço (opcional) |
| `createdAt` | `timestamp` | DEFAULT now() | |
| `updatedAt` | `timestamp` | DEFAULT now() | |

> **Nota:** Better Auth cria automaticamente as tabelas `users`, `sessions`, `accounts` e `verifications`. O schema acima estende a tabela `users` com campos adicionais. Consultar a documentação do Better Auth para a forma correta de estender o schema com Drizzle.

### 4.2 Tabela `items`

| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | |
| `sellerId` | `text` | FK → users.id, NOT NULL | |
| `title` | `text` | NOT NULL | Título da peça |
| `description` | `text` | NOT NULL | Descrição detalhada |
| `type` | `enum('product','service','piece')` | NOT NULL | Tipo do item |
| `imageUrl` | `text` | NULLABLE | Imagem principal |
| `minInitialBid` | `integer` | NOT NULL | Lance mínimo inicial (em centavos) |
| `minBidIncrement` | `integer` | NOT NULL | Valor mínimo entre lances (em centavos) |
| `bidDeadline` | `timestamp` | NOT NULL | Data limite para lances |
| `paymentDeadlineDays` | `integer` | NOT NULL, DEFAULT 3 | Dias para pagamento após arremate |
| `status` | `enum('draft','active','closed','awaiting_payment','paid','cancelled')` | DEFAULT 'draft' | |
| `createdAt` | `timestamp` | DEFAULT now() | |
| `updatedAt` | `timestamp` | DEFAULT now() | |

### 4.3 Tabela `bids`

| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `itemId` | `uuid` | FK → items.id, NOT NULL | |
| `bidderId` | `text` | FK → users.id, NOT NULL | |
| `amount` | `integer` | NOT NULL | Valor do lance (em centavos) |
| `rank` | `integer` | NULLABLE | Posição do lance (1º, 2º, 3º...) |
| `createdAt` | `timestamp` | DEFAULT now() | |

### 4.4 Tabela `payments`

| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `itemId` | `uuid` | FK → items.id, NOT NULL | |
| `bidderId` | `text` | FK → users.id, NOT NULL | Arrematante atual |
| `bidId` | `uuid` | FK → bids.id, NOT NULL | Lance associado |
| `amount` | `integer` | NOT NULL | Valor a pagar (em centavos) |
| `mpPaymentId` | `text` | NULLABLE | ID do pagamento no Mercado Pago |
| `pixQrCode` | `text` | NULLABLE | QR Code PIX |
| `pixQrCodeBase64` | `text` | NULLABLE | Imagem do QR Code |
| `paymentLink` | `text` | NULLABLE | Link de pagamento |
| `status` | `enum('pending','approved','expired','cancelled','refunded')` | DEFAULT 'pending' | |
| `deadline` | `timestamp` | NOT NULL | Prazo para pagamento |
| `attemptNumber` | `integer` | DEFAULT 1 | 1 = 1º lugar, 2 = 2º lugar, etc. |
| `createdAt` | `timestamp` | DEFAULT now() | |
| `updatedAt` | `timestamp` | DEFAULT now() | |

### 4.5 Tabela `notifications`

| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `userId` | `text` | FK → users.id, NOT NULL | |
| `type` | `enum('outbid','won','payment_due','payment_expired','payment_confirmed')` | NOT NULL | |
| `title` | `text` | NOT NULL | |
| `content` | `text` | NOT NULL | |
| `read` | `boolean` | DEFAULT false | |
| `createdAt` | `timestamp` | DEFAULT now() | |

---

## 5. Regras de Negócio Principais

### 5.1 Cadastro e Vitrine do Leiloeiro
- O leiloeiro se cadastra e define um **slug** único (ex: `leiloeironerd.com/nerd-colecionaveis`).
- A página `/{slug}` exibe todos os itens ativos do leiloeiro.
- O leiloeiro pode ter múltiplos itens em diferentes status.

### 5.2 Cadastro de Itens
- Campos obrigatórios: título, descrição, tipo, lance mínimo inicial, incremento mínimo entre lances, prazo para lances, prazo para pagamento.
- O `minBidIncrement` impede lances com diferença irrisória (ex: R$ 0,01).
- O item só entra em leilão quando o status muda de `draft` para `active`.

### 5.3 Registro de Lances
- O arrematante deve estar cadastrado (nome/nick, e-mail, celular; endereço opcional).
- **Validações ao dar lance:**
  - O item deve estar com status `active` e dentro do `bidDeadline`.
  - O lance deve ser ≥ `minInitialBid` (se for o primeiro lance).
  - O lance deve ser ≥ (maior lance atual + `minBidIncrement`).
  - O arrematante não pode dar lance em seu próprio item.
- Após cada lance, o arrematante anterior (se houver) recebe notificação de que foi superado.

### 5.4 Encerramento do Leilão
- Quando o `bidDeadline` é atingido, o cron job altera o status para `closed`.
- O sistema gera um registro de pagamento para o **1º colocado** com `deadline = now() + paymentDeadlineDays`.
- O arrematante vencedor recebe e-mail com:
  - Link de pagamento Mercado Pago
  - QR Code PIX
  - Prazo para pagamento

### 5.5 Fluxo de Inadimplência (Cascata de Lances)
1. O cron job verifica pagamentos com `status = 'pending'` e `deadline < now()`.
2. Se o pagamento expirou:
   - Marca o pagamento como `expired`.
   - Busca o próximo lance válido (2º, 3º, etc.) que ainda não foi tentado.
   - Cria novo registro de pagamento para o próximo arrematante com novo `deadline`.
   - Envia e-mail de notificação com novo Link de pagamento/QR Code.
3. Se não houver mais lances, o item volta para o leiloeiro com status `cancelled`.

---

## 6. Fluxos e Endpoints / Server Actions

### 6.1 Autenticação (Better Auth)

| Rota | Método | Descrição |
|---|---|---|
| `/login` | GET | Página de login |
| `/register` | GET/POST | Cadastro de usuário |
| `/api/auth/*` | * | Rotas internas do Better Auth |

### 6.2 Server Actions — Itens

| Action | Descrição |
|---|---|
| `createItem(data)` | Cria item em rascunho |
| `updateItem(id, data)` | Atualiza item |
| `publishItem(id)` | Muda status de `draft` → `active` |
| `cancelItem(id)` | Cancela item |
| `getItemBySlugAndId(slug, itemId)` | Busca item para página pública |

### 6.3 Server Actions — Lances

| Action | Descrição |
|---|---|
| `placeBid(itemId, amount)` | Registra lance com validações |
| `getItemBids(itemId)` | Lista lances de um item |
| `getHighestBid(itemId)` | Retorna maior lance atual |

### 6.4 Server Actions — Pagamentos

| Action | Descrição |
|---|---|
| `generatePayment(paymentId)` | Gera QR Code PIX / Link de pagamento via Mercado Pago |
| `checkPaymentStatus(paymentId)` | Consulta status no Mercado Pago |

### 6.5 Rotas de API (Webhooks)

| Rota | Método | Descrição |
|---|---|---|
| `/api/webhooks/mercadopago` | POST | Webhook de confirmação de pagamento |

---

## 7. Cron Jobs / Filas (Inngest ou Vercel Cron)

| Job | Frequência | Descrição |
|---|---|---|
| `close-expired-auctions` | A cada 5 min | Verifica itens com `bidDeadline < now()` e status `active`, muda para `closed` e gera pagamento do 1º colocado |
| `check-payment-deadlines` | A cada 10 min | Verifica pagamentos `pending` com `deadline < now()`, expira e notifica próximo lance |
| `sync-mp-payments` | A cada 15 min | Consulta Mercado Pago para pagamentos pendentes (backup do webhook) |
| `send-reminder-emails` | Diário, 08:00 | Envia lembrete para pagamentos que vencem em 24h |

---

## 8. Templates de E-mail (Resend)

| Template | Gatilho | Conteúdo |
|---|---|---|
| `welcome` | Cadastro | Boas-vindas |
| `outbid` | Lance superado | "Seu lance em {item} foi superado" |
| `auction-won` | Leilão encerrado (1º lugar) | "Parabéns! Você arrematou {item}" + link de pagamento/QR Code |
| `payment-reminder` | 24h antes do prazo | "Seu pagamento de {item} vence amanhã" |
| `payment-expired` | Prazo esgotado | "Seu prazo de pagamento expirou" |
| `next-bidder-called` | 2º+ lugar chamado | "O arrematante anterior não pagou. Você tem {dias} para pagar {item}" + link de pagamento/QR Code |
| `payment-confirmed` | Webhook MP | "Pagamento confirmado! {item} é seu" |

---

## 9. Páginas (App Router)

### 9.1 Rotas Públicas `(public)`

| Rota | Descrição |
|---|---|
| `/` | Landing page |
| `/{slug}` | Vitrine do leiloeiro (lista de itens ativos) |
| `/{slug}/{itemId}` | Página do item com detalhes, histórico de lances e formulário de lance |

### 9.2 Rotas de Autenticação `(auth)`

| Rota | Descrição |
|---|---|
| `/login` | Login |
| `/register` | Cadastro |
| `/forgot-password` | Recuperação de senha |

### 9.3 Dashboard `(dashboard)` — Protegido

| Rota | Descrição |
|---|---|
| `/dashboard` | Visão geral |
| `/dashboard/items` | Lista de itens do leiloeiro |
| `/dashboard/items/new` | Criar novo item |
| `/dashboard/items/[id]/edit` | Editar item |
| `/dashboard/bids` | Meus lances (arrematante) |
| `/dashboard/payments` | Meus pagamentos |
| `/dashboard/payments/[id]` | Detalhe do pagamento (QR Code / Link de pagamento) |
| `/dashboard/settings` | Configurações do perfil |

---

## 10. Integração com Mercado Pago

### 10.1 Fluxo PIX
1. Ao gerar pagamento, chamar a API do Mercado Pago para criar uma **preferência de pagamento PIX**.
2. Armazenar o `qr_code` (string) e `qr_code_base64` (imagem) no banco.
3. Exibir o QR Code na página de pagamento do arrematante.

### 10.2 Fluxo Link de Pagamento
1. Criar **Payment Link** via API do Mercado Pago.
2. Armazenar a URL no campo `paymentLink`.
3. Incluir o link no e-mail de notificação.

### 10.3 Webhook
1. Configurar URL de webhook no painel do Mercado Pago: `https://leiloeironerd.com/api/webhooks/mercadopago`.
2. Ao receber `status = approved`, atualizar o pagamento no banco e disparar e-mail de confirmação.
3. Atualizar o status do item para `paid`.

---

## 11. Fases de Desenvolvimento

### 🟢 Fase 1 — Fundação (Semanas 1–2)
- [ ] Inicializar projeto Next.js 16 com TypeScript
- [ ] Configurar Tailwind CSS + Shadcn/UI
- [ ] Configurar PostgreSQL + Drizzle ORM
- [ ] Definir e rodar migrações do schema
- [ ] Configurar Better Auth (registro, login, sessão)
- [ ] Estruturar pastas em Clean Architecture
- [ ] Configurar variáveis de ambiente (`.env`)

### 🟡 Fase 2 — Core do Leilão (Semanas 3–5)
- [ ] CRUD de itens (Server Actions + formulários)
- [ ] Upload de imagens (sugestão: Uploadthing ou Cloudinary)
- [ ] Página de vitrine do leiloeiro (`/{slug}`)
- [ ] Página de detalhe do item (`/{slug}/{itemId}`)
- [ ] Sistema de lances com validações
- [ ] Notificação de lance superado (Resend)
- [ ] Componente de countdown para `bidDeadline`

### 🟠 Fase 3 — Pagamentos e Automação (Semanas 6–8)
- [ ] Integração Mercado Pago (PIX + Link)
- [ ] Página de pagamento com QR Code
- [ ] Webhook de confirmação de pagamento
- [ ] Cron job: encerramento de leilões
- [ ] Cron job: verificação de prazos de pagamento
- [ ] Lógica de cascata (2º, 3º lugar...)
- [ ] E-mails transacionais (Resend)

### 🔴 Fase 4 — Refinamento e Lançamento (Semanas 9–10)
- [ ] Dashboard completo (leiloeiro + arrematante)
- [ ] Histórico de lances e pagamentos
- [ ] Tratamento de erros e edge cases
- [ ] Testes (unitários + e2e com Playwright)
- [ ] SEO e Open Graph para páginas de itens
- [ ] Responsividade e acessibilidade (a11y)
- [ ] Deploy (Vercel) + configuração de domínio
- [ ] Monitoramento e logs

---

## 12. Variáveis de Ambiente (`.env.example`)

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/leiloeironerd

# Better Auth
BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_URL=https://leiloeironerd.com

# Mercado Pago
MERCADO_PAGO_ACCESS_TOKEN=TEST-xxxx
MERCADO_PAGO_PUBLIC_KEY=TEST-xxxx
MERCADO_PAGO_WEBHOOK_SECRET=xxxx

# Resend
RESEND_API_KEY=re_xxxx
RESEND_FROM_EMAIL=Leiloeiro Nerd <noreply@leiloeironerd.com>

# App
NEXT_PUBLIC_APP_URL=https://leiloeironerd.com
```

---

## 13. Considerações Importantes

| Tópico | Detalhe |
|---|---|
| **Valores monetários** | Sempre armazenar em **centavos** (integer) para evitar problemas de ponto flutuante |
| **Idempotência** | Webhooks do Mercado Pago podem ser duplicados; verificar `mpPaymentId` antes de processar |
| **Race conditions** | Lances simultâneos devem ser tratados com transações no banco (SELECT FOR UPDATE ou optimistic locking) |
| **Segurança** | Validar slugs contra injeção; sanitizar inputs; rate limiting em lances |
| **Better Auth** | Sempre consultar a [documentação oficial](https://www.better-auth.com/docs) para configuração com Drizzle e plugins |
| **Escalabilidade** |  Usar Redis + Bull com verificação de prazos e disparo de notificações |

---

## 14. Diagrama de Fluxo — Ciclo de Vida de um Item

```
[Leiloeiro cria item]
        │
        ▼
   status: draft
        │
   [Publica item]
        │
        ▼
   status: active  ◄──── Lances são aceitos
        │
  [bidDeadline atinge]
        │
        ▼
   status: closed
        │
  [Gera pagamento 1º lugar]
        │
        ▼
  status: awaiting_payment
        │
   ┌────┴────┐
   │         │
 [Pago]   [Expirou]
   │         │
   ▼         ▼
status:    [Notifica 2º lugar]
 paid        │
             ▼
        [Pago?] ──Sim──► status: paid
             │
            Não
             │
             ▼
        [Notifica 3º lugar]
             │
            ...
             │
        [Sem mais lances]
             │
             ▼
        status: cancelled
```
