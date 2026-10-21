# Spec: Sub-projeto 2c — Lances + Notificações + Countdown

## 1. Visão Geral

Implementar o sistema de lances (bidding) com validações de negócio, notificações de "lance superado" via Resend + in-app, e integração completa do countdown timer na página de detalhe do item. Polling simples (10s) via server actions — sem WebSocket/SSE.

## 2. Escopo

### Incluído
- Server Action `placeBidAction(itemId, amount)` com validações completas
- Server Action `getItemBidsAction(itemId)` para polling
- BidRepository com `createBid` (insere com rank automático)
- Notificações "lance superado": in-app (tabela notifications) + email (Resend template `outbid`)
- Polling 10s na página de detalhe (`/{slug}/{itemId}`) atualizando `BidHistory` + `BidCountdown`
- Countdown timer já existente (`BidCountdown`) integrado na página de detalhe
- Validações: status active, deadline, minInitialBid/minBidIncrement, não-seller, autenticação

### Excluído (Fase 3+)
- WebSocket/SSE para tempo real
- Proxy bids (lance máximo automático)
- Lances selados (sealed bids)
- Webhook/pagamentos (Fase 3)
- Cron jobs de encerramento (Fase 3)

## 3. Arquitetura

### 3.1 Fluxo de Lance (placeBid)

```
Client (ItemDetailPage)
  → placeBidAction(itemId, amount) [Server Action]
    → getSession() → valida autenticação
    → getItemBySlugAndId (ou findById) → valida item existe, status=active, deadline>now
    → getItemBids(itemId) → pega maior lance atual
    → Valida: amount >= minInitialBid (se 1º) OU amount >= maiorLance + minBidIncrement
    → Valida: bidderId !== item.sellerId
    → bidRepo.createBid(itemId, bidderId, amount) → insere com rank = count+1
    → Se havia lance anterior: notifica arrematante anterior
      → notifications.create(outbid, userId=anteriorBidderId)
      → Resend.sendEmail(outbid template)
    → Retorna { ok: true, bid: {...} } ou { error: "..." }
Client recebe resultado → atualiza UI via polling (ou otimista)
```

### 3.2 Polling (10s)

```tsx
// Em ItemDetailPage (client component)
useEffect(() => {
  const interval = setInterval(async () => {
    const { bids } = await getItemBidsAction(itemId);
    setBids(bids); // atualiza BidHistory
  }, 10000);
  return () => clearInterval(interval);
}, [itemId]);
```

### 3.3 Notificação "Lance Superado"

**In-app** (tabela `notifications`):
- `type: "outbid"`
- `title: "Lance superado"`
- `content: "Seu lance de R$ X em {item.title} foi superado por R$ Y"`
- `read: false`

**Email (Resend)**:
- Template `outbid` (configurado no Better Auth / Resend)
- Assunto: "Seu lance foi superado!"
- Corpo: "Seu lance de R$ X em {item.title} foi superado. Dê um novo lance: {link}"

## 4. Contratos (Interfaces)

### 4.1 Domain Types (src/domain/repositories/bid-repository.ts)

```ts
export interface Bid {
  id: string;
  itemId: string;
  bidderId: string;
  bidderName: string;
  amount: number; // centavos
  rank: number | null;
  createdAt: Date;
}

export interface CreateBidInput {
  itemId: string;
  bidderId: string;
  amount: number;
}

export interface BidRepository {
  findByItemId(itemId: string): Promise<Bid[]>;
  createBid(input: CreateBidInput): Promise<Bid>;
}
```

### 4.2 Use Cases (src/application/use-cases/)

```ts
// place-bid.ts
export async function placeBid(
  itemRepo: ItemRepository,
  bidRepo: BidRepository,
  userRepo: UserRepository,
  notificationRepo: NotificationRepository,
  resend: ResendClient,
  bidderId: string,
  itemId: string,
  amount: number,
): Promise<{ bid: Bid; outbidUserId?: string }>

// get-item-bids.ts
export async function getItemBids(
  bidRepo: BidRepository,
  itemId: string,
): Promise<Bid[]>
```

### 4.3 Server Actions (src/presentation/actions/bid-actions.ts)

```ts
export async function placeBidAction(_prev: BidActionResult, formData: FormData): Promise<BidActionResult>
export async function getItemBidsAction(_prev: BidActionResult, formData: FormData): Promise<BidActionResult>
```

### 4.4 Validações (src/lib/validators.ts)

```ts
export const placeBidSchema = z.object({
  itemId: z.string().uuid(),
  amount: z.coerce.number().positive().refine(v => v >= 100, "Lance mínimo R$ 1,00"),
});
```

## 5. Validações de Negócio

| Regra | Erro |
|-------|------|
| Item não existe | "Item não encontrado" |
| Item status ≠ active | "Item não está em leilão" |
| Deadline passou | "Leilão encerrado" |
| Lance < minInitialBid (1º) | "Lance deve ser ≥ lance mínimo inicial" |
| Lance < maiorLance + minBidIncrement | "Lance deve ser ≥ lance atual + incremento mínimo" |
| Usuário é seller do item | "Você não pode dar lance no próprio item" |
| Usuário não autenticado | "Faça login para dar lances" |
| Usuário role ≠ bidder|both | "Apenas arrematantes podem dar lances" |

## 6. Notificações (Resend)

### 6.1 Template `outbid` (Resend Dashboard)

- **Subject**: "Seu lance em {itemTitle} foi superado!"
- **HTML**: 
  - "Olá {bidderName},"
  - "Seu lance de **R$ {oldAmount}** em **{itemTitle}** foi superado por **R$ {newAmount}**."
  - "[Dar novo lance]({itemUrl})"
- **Variables**: `bidderName`, `itemTitle`, `oldAmount`, `newAmount`, `itemUrl`

### 6.2 Integração Resend

- `RESEND_API_KEY` já em `.env.example` (Fase 3 placeholder)
- Cliente: `resend.emails.send({ from, to, subject, html })`
- Fallback: se Resend falhar, loga erro mas não quebra o lance

## 7. Componentes UI (Já existentes — integração apenas)

| Componente | Props | Status |
|------------|-------|--------|
| `BidCountdown` | `deadline: Date` | ✅ Task 7 — mostra "Encerrado" quando ≤0 |
| `BidHistory` | `bids: Bid[]` | ✅ Task 7 — tabela rank/valor/nome/data |
| `ItemGallery` | `images: string[]` | ✅ Task 7 |
| `PublicItemCard` | `item, slug, imageUrl` | ✅ Task 7 |

## 8. Páginas (Integração)

### 8.1 `/{slug}/{itemId}` (ItemDetailPage)
- Já renderiza: `ItemGallery`, `BidCountdown`, `BidHistory`
- **Nova**: adicionar `useEffect` polling 10s → `getItemBidsAction`
- Estado `bids` atualiza `BidHistory` automaticamente
- Botão "Dar lance" → `<form action={placeBidAction}>` com `<input name="amount" type="number" step="0.01" min="1" />`

## 9. Testes

| Tipo | Arquivo | Cenários |
|------|---------|----------|
| Unit | `place-bid.test.ts` | Validações, rank, notificação outbid |
| Unit | `get-item-bids.test.ts` | Ordenação, rank |
| Unit | `bid-repository.test.ts` | createBid insere com rank correto |
| Integration | `place-bid-action.test.ts` | Session guard, validações, resend mock |
| Integration | `get-item-bids-action.test.ts` | Retorna bids ordenados |

## 10. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Race condition em lances simultâneos | Transação DB com `SELECT FOR UPDATE` no item ou lock otimista (version) |
| Polling 10s perde lances intermediários | Acceptable para leilões lentos; server action sempre valida estado atual |
| Resend falha silenciosa | Try/catch + log; lance persiste mesmo se email falhar |
| Ranking incorreto em lances iguais | Tie-break por `createdAt` (primeiro chega primeiro) |

## 11. Checklist de Implementação

- [ ] `BidRepository.createBid` + teste
- [ ] `place-bid` use case + testes TDD
- [ ] `get-item-bids` use case + testes
- [ ] `NotificationRepository` (create outbid) + teste
- [ ] `placeBidAction` + `getItemBidsAction` server actions
- [ ] Resend template `outbid` + integração envio
- [ ] Polling 10s em `ItemDetailPage` (client component)
- [ ] Form de lance em `ItemDetailPage` (`<form action={placeBidAction}>`)
- [ ] Testes integração actions + páginas
- [ ] `pnpm test`, `tsc`, `lint`, `build` passam
- [ ] Smoke manual: dar lance → notificação in-app + email → polling atualiza