# Spec: Sub-projeto 2b — Vitrine Pública + Upload de Imagens (UploadThing)

## 1. Visão Geral

Implementar a vitrine pública do leiloeiro (`/{slug}`) e a página de detalhe do item (`/{slug}/{itemId}`), com upload de múltiplas imagens via UploadThing integrado ao fluxo de criação/edição de itens no dashboard.

## 2. Escopo

### Incluído
- Rotas públicas: `/{slug}` (vitrine), `/{slug}/{itemId}` (detalhe do item)
- Upload de múltiplas imagens via UploadThing (galeria por item)
- Novo schema DB: tabela `item_images`
- Use cases públicos: busca por slug, listagem ativa, detalhe com lances
- Componentes UI: galeria, countdown, histórico de lances, card público
- Integração no `ItemForm` (dashboard) para upload/remoção de imagens

### Excluído (Fase 2c)
- Formulário de lance funcional (`placeBidAction`)
- Notificações de lance superado
- Webhook Mercado Pago / pagamentos
- Cron jobs de encerramento

## 3. Arquitetura

### 3.1 Rotas (App Router)

```
src/app/(public)/
├── layout.tsx                    # Layout público (header simples)
├── [slug]/
│   ├── page.tsx                  # Vitrine: lista itens active do seller
│   └── [itemId]/
│       └── page.tsx              # Detalhe: item + imagens + lances + countdown
```

- Grupo `(public)` sem autenticação (middleware `proxy.ts` não protege)
- `generateStaticParams` opcional para SSG da vitrine (futuro)

### 3.2 Schema DB — `item_images`

```sql
CREATE TABLE item_images (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  url             text NOT NULL,                    -- URL retornada pelo UploadThing
  position        integer NOT NULL DEFAULT 0,       -- ordem na galeria
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX item_images_item_id_idx ON item_images(item_id);
```

- `items.imageUrl` mantido como thumbnail (primeira imagem da galeria, ou null)
- Cascade delete: ao deletar item, apaga imagens associadas

### 3.3 UploadThing

- Config: `src/infrastructure/upload/uploadthing.ts`
- FileRouter: `itemImages` (múltiplos, max 10, max 5MB cada, tipos: image/*)
- Server actions:
  - `uploadItemImagesAction(formData)` → `{ urls: string[] }`
  - `deleteItemImageAction(imageId)` → void
- Integração no `ItemForm`: dropzone → upload → preview → ao submit, envia array de URLs

### 3.4 Use Cases (Application)

| Use Case | Input | Output | Descrição |
|----------|-------|--------|-----------|
| `getSellerBySlug(slug)` | `slug: string` | `UserProfile \| null` | Busca seller público |
| `listActiveItemsBySellerId(sellerId)` | `sellerId: string` | `Item[]` | Itens `active` ordenados por `createdAt` desc |
| `getItemBySlugAndId(slug, itemId)` | `slug, itemId` | `{ item, images, bids } \| null` | Detalhe completo (valida seller + status active) |
| `getItemBids(itemId)` | `itemId` | `Bid[]` | Histórico de lances (amount, rank, createdAt, bidderName) |
| `createItemImages(itemId, urls[])` | `itemId, urls[]` | `ItemImage[]` | Persiste URLs retornadas pelo UploadThing |
| `deleteItemImage(imageId)` | `imageId` | `void` | Remove imagem (valida ownership) |

### 3.5 Repository (Infrastructure)

- `ItemRepository` estendido:
  - `findImagesByItemId(itemId)` → `ItemImage[]`
  - `createImages(itemId, urls[])` → `ItemImage[]`
  - `deleteImage(imageId)` → `void`
- `UserRepository`: já tem `findBySlug` (usado por `getSellerBySlug`)
- `BidRepository` (novo): `findByItemId(itemId)` → `Bid[]` (para histórico)

### 3.6 Server Actions (Presentation)

**Públicas (sem auth):**
- `getSellerVitrineAction(slug)` → `{ seller, items }`
- `getItemDetailAction(slug, itemId)` → `{ item, images, bids }`

**Dashboard (com auth):**
- `uploadItemImagesAction(formData)` → `{ urls: string[] }`
- `deleteItemImageAction(imageId)` → `void`

### 3.7 Componentes UI (src/components/)

| Componente | Props | Descrição |
|------------|-------|-----------|
| `ItemGallery` | `images: string[]` | Carrossel/grid responsivo (thumbnail principal + thumbnails) |
| `BidCountdown` | `deadline: Date` | Timer regressivo (dias/horas/min/seg) |
| `BidHistory` | `bids: Bid[]` | Tabela: posição, valor, arrematante, data |
| `PublicItemCard` | `item: Item, imageUrl?` | Card vitrine: thumb, título, lance mínimo, link |

### 3.8 Validações (src/lib/validators.ts)

- `imageUploadSchema`: `z.instanceof(FileList).refine(...)` — max 10 arquivos, 5MB cada, `image/*`
- `slug` validação já existe (`createSlug` + `becomeSellerSchema`)

## 4. Fluxo de Dados

### 4.1 Criação/Edição de Item (Dashboard)

1. Seller preenche `ItemForm` + seleciona imagens (dropzone)
2. `ItemForm` chama `uploadItemImagesAction(formData)` → UploadThing → retorna `urls[]`
3. Preview local das imagens (object URLs)
4. Ao submeter o form: `createItemAction`/`updateItemAction` recebe `imageUrls[]` no FormData
5. Use case `createItem`/`updateItem` persiste item + chama `createItemImages(itemId, urls[])`

### 4.2 Vitrine Pública (`/{slug}`)

1. `GET /{slug}` → `ItemsPage` chama `getSellerVitrineAction(slug)`
2. Action → `getSellerBySlug` + `listActiveItemsBySellerId`
3. Retorna `{ seller, items[] }` → renderiza grid de `PublicItemCard`

### 4.3 Detalhe do Item (`/{slug}/{itemId}`)

1. `GET /{slug}/{itemId}` → `ItemDetailPage` chama `getItemDetailAction(slug, itemId)`
2. Action → `getItemBySlugAndId` (valida seller + status `active`) + `getItemBids`
3. Retorna `{ item, images[], bids[] }` → renderiza `ItemGallery` + `BidCountdown` + `BidHistory`

## 5. Integração com Item Existente

- `Item` domain interface ganha opcional `images?: string[]` (para preview no form)
- `CreateItemInput` / `UpdateItemInput` ganham `imageUrls?: string[]`
- `itemSchema` (validators) adiciona `imageUrls: z.array(z.string().url()).max(10).optional()`

## 6. Configuração UploadThing

```env
# .env
UPLOADTHING_SECRET=sk_live_xxx
UPLOADTHING_APP_ID=xxx
```

- `uploadthing.ts` usa `createUploadthing` + `buildFileRouter`
- Middleware Next.js: `export const config = { matcher: ["/api/uploadthing/*"] }`

## 7. Testes

- Unit: use cases, validators, repository methods (mock Drizzle)
- Integration: server actions (mock UploadThing), páginas (render + searchParams)
- E2E (futuro): fluxo completo create → upload → publish → view vitrine

## 8. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| UploadThing rate limits / custos | Limite 10 imagens/item, 5MB cada; validação client + server |
| Imagens órfãs se item creation falhar | Upload separado do submit; cleanup job periódico ou TTL no UploadThing |
| SSG da vitrine com dados dinâmicos | Usar `force-dynamic` inicialmente; `generateStaticParams` + revalidate no futuro |
| Acesso a itens de outros sellers | `getItemBySlugAndId` valida `item.seller.slug === slug` e `status === active` |

## 9. Checklist de Implementação

- [ ] Schema `item_images` + migração Drizzle
- [ ] `ItemRepository` estendido (images)
- [ ] `BidRepository` (novo)
- [ ] Use cases (6)
- [ ] UploadThing config + server actions upload/delete
- [ ] Server actions públicas (vitrine + detalhe)
- [ ] Componentes UI (4)
- [ ] Páginas públicas (3)
- [ ] Integração `ItemForm` + `itemSchema` (imageUrls)
- [ ] Testes unitários + integração
- [ ] Build + lint + typecheck