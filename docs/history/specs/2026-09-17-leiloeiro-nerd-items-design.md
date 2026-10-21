# Leiloeiro Nerd — Sub-projeto 2a: CRUD de Itens e Dashboard

- **Data:** 2026-09-17
- **Status:** aprovado para implementação
- **Base:** Fase 2 do `docs/project.md`

## 1. Visão Geral

Sub-projeto 2a implementa o **CRUD de itens** para leiloeiros e o **dashboard de
gerenciamento de itens**, incluindo o fluxo de **upgrade de role para seller**
(self-service, sem aprovação manual). É a fundação da Fase 2 do roadmap; upload
de imagens, vitrine pública, página de item, lances e countdown ficam para os
sub-projetos 2b e 2c.

## 2. Escopo

### Dentro do escopo

- Contrato `ItemRepository` (Drizzle) e 6 use cases granulares de item.
- Use case `become-seller` (upgrade de role com slug da vitrine).
- Autorização por role (`seller`/`both`) em defesa em profundidade.
- Server actions de item; páginas de dashboard: lista (filtro por status), novo, edição.
- Validações zod de item e de upgrade de role.
- Testes unitários (TDD) dos use cases com repositório fake.
- UI: formulário compartilhado de item, badge de status, form de become-seller.

### Fora do escopo (próximos sub-projetos)

- 2b: upload de imagens, vitrine pública `/{slug}`, página pública `/{slug}/{itemId}`.
- 2c: sistema de lances com validações, notificações de lance superado, countdown.

## 3. Arquitetura

Segue a Clean Architecture pragmática já estabelecida (ver
`docs/project.md` e o spec da fundação). Fluxo por operação:

```
server action (item-actions.ts)
  → getSession() + valida sessão/seller
  → zod parse do FormData
  → use case (regras de negócio)
      → ItemRepository / UserRepository (Drizzle)
```

- **Use case = função pura**, recebe repositórios/interfaces como argumentos; sem import de infra.
- **Server action = orquestrador fino** que monta as deps concretas e chama o use case.
- Não duplicar entidades desnecessariamente: os dados de item já existem no schema Drizzle; o domínio expõe apenas contratos (interfaces) e use cases.

## 4. Contrato `ItemRepository`

Arquivo `src/domain/repositories/item-repository.ts` (interface):

| Método | Assinatura | Descrição |
|---|---|---|
| `create` | `(input) => Promise<Item>` | Cria item |
| `update` | `(id, input) => Promise<Item \| null>` | Atualiza item; null se não existir |
| `findById` | `(id) => Promise<Item \| null>` | Busca por id |
| `findBySellerId` | `(sellerId, filter?) => Promise<Item[]>` | Lista do seller; `filter.status` opcional |
| `delete` | `(id) => Promise<void>` | Delete físico (só draft) |
| `setStatus` | `(id, status) => Promise<Item \| null>` | Transição de status |
| `countBids` | `(itemId) => Promise<number>` | Nº de lances (bloqueio de edição/delete) |

Implementação concreta em `src/infrastructure/database/repositories/drizzle-item-repository.ts`, mapeando para a tabela `items` já existente no schema.

## 5. Use cases

Todos em `src/application/use-cases/`, funções puras com deps injetadas e TDD.

### 5.1 `create-item.ts`

- Valida `userId` e role do usuário ∈ `{seller, both}`; caso contrário lança erro de domínio ("Apenas leiloeiros podem criar itens").
- Persiste item com status `draft`, `sellerId` = usuário logado.
- Campos de saída: item criado.

### 5.2 `update-item.ts`

- Bloqueia edição se `status ≠ draft` (publicado não pode mudar).
- Bloqueia edição se houver lances (defesa extra; no 2a não há lances, mas há o contrato).
- Aplica apenas campos permitidos: título, descrição, tipo, valores, prazos.

### 5.3 `publish-item.ts`

- Transição `draft` → `active`.
- Rejeita se `status ≠ draft` ("Item já publicado").
- Irreversível (sem ação de voltar para draft).

### 5.4 `cancel-item.ts`

- Aceita `active` ou `closed` → `cancelled`.
- Rejeita se já cancelado ou se status incompatível.

### 5.5 `delete-item.ts`

- Delete físico apenas se `status = draft`.
- Rejeita se houver lances (`countBids > 0`), mesmo em draft.

### 5.6 `list-seller-items.ts`

- Lista itens de um `sellerId`, com filtro opcional por status.
- Página de dashboard usa para montar a lista com tabs de status.

### 5.7 `become-seller.ts`

- Roda em `/dashboard/settings`. Input: `slug` + `role` (`seller` | `both`).
- Slug é normalizado via `createSlug` (value object existente) e validado único (erro 23505 → "Este slug já está em uso").
- Atualiza `user.role` e `user.slug` via `UserRepository.updateRole()`.

## 6. Autorização

- **Use cases** validam role ∈ `{seller, both}` — regra de negócio central.
- **Server actions** só procuram sessão ativa; delegam a regra de role ao use case.
- **UI:** páginas `/dashboard/items*` exibem estado "venda como leiloeiro" (form become-seller) quando role é `bidder`, em vez do formulário de item. Erros retornados pelos use cases são exibidos em pt-BR.
- O proxy `src/proxy.ts` já protege `/dashboard` — sem mudanças.

## 7. Validações (zod)

Em `src/lib/validators.ts`:

**`itemSchema`:**
- `title`: string 3–150, não vazia.
- `description`: string 10–5000.
- `type`: enum `product | service | piece`.
- `minInitialBid`: inteiro, ≥ 100 (centavos, R$ 1,00).
- `minBidIncrement`: inteiro, ≥ 100 (centavos, R$ 1,00).
- `bidDeadline`: `z.coerce.date()`, refine "deve ser futura".
- `paymentDeadlineDays`: inteiro 1–30, default 3.
- `imageUrl`: aceito como vazio/undefined no 2a (upload é 2b), campo não preenchido.

**`becomeSellerSchema`:**
- `slug`: string, normaliza via `createSlug` (valida formato e tamanho).
- `role`: enum `seller | both`.

## 8. Server actions

Arquivo `src/presentation/actions/item-actions.ts` (`"use server"`):

| Action | Comportamento |
|---|---|
| `createItemAction` | session → zod → create-item → redirect `/dashboard/items` |
| `updateItemAction` | session → zod → update-item → redirect `/dashboard/items` |
| `publishItemAction` | session → publish-item → redirect `/dashboard/items` |
| `cancelItemAction` | session → cancel-item → redirect `/dashboard/items` |
| `deleteItemAction` | session → delete-item → redirect `/dashboard/items` |

E em `src/presentation/actions/profile-actions.ts`, nova action:
`becomeSellerAction(_prev, formData)` → session → zod → become-seller → `{ ok }`.

Padrão de retorno `ActionResult = { ok?: boolean; error?: string }` (pt-BR), mesmo estilo de `profile-actions.ts`. Erros de unicidade de slug (código 23505 no Postgres) mapeados para "Este slug já está em uso".

## 9. Páginas e componentes

### Rotas (em `src/app/(dashboard)/`)

| Rota | Conteúdo |
|---|---|
| `/dashboard/items` | Lista de itens do seller; tabs de status (todos/draft/active/...) + ações inline (publicar, cancelar, editar, deletar-draft) |
| `/dashboard/items/new` | Formulário de criação |
| `/dashboard/items/[id]/edit` | Formulário de edição (campos bloqueados se publicado) |

### Componentes (em `src/components/`)

- `item-form.tsx` — compartilhado entre new/edit; usa `useActionState`; mode edit bloqueia campos de lance quando publicado.
- `item-status-badge.tsx` — badge visual do status.
- `become-seller-form.tsx` — em settings; slug + role com preview do slug via `createSlug`.

Fluxo de UI quando role = `bidder`: ao acessar `/dashboard/items`, mostrar call-to-action "Ativar conta de leiloeiro" (link ao form em settings) — não mostrar formulários de item.

## 10. Error handling

- Formulários: `useActionState` + `ActionResult` (`ok`/`error`), mensagens em pt-BR.
- Erros de domínio (role inválido, status incompatível) viram `{ error: "<mensagem>" }`.
- Unicidade de slug: captura código `23505`/duplicate no catch → "Este slug já está em uso".
- Erros inesperados: mensagem genérica "Não foi possível concluir. Tente novamente." com log no console.

## 11. Testes (TDD)

Vitest, `*.test.ts` ao lado dos use cases com repositório fake (in-memory), mesma abordagem de `update-profile.test.ts`.

Casos previstos (~14):

| Use case | Casos |
|---|---|
| `create-item` | aceita seller; aceita both; rejeita bidder (erro domínio); rejeita deadline passada; rejeita valores < 100 |
| `update-item` | permite em draft; bloqueia em active; bloqueia com lances; aplica só campos permitidos |
| `publish-item` | draft→active; rejeita não-draft |
| `cancel-item` | active→cancelled; closed→cancelled; rejeita draft |
| `delete-item` | só draft; rejeita com lances |
| `become-seller` | completes upgrade e promove role; erros de slug duplicado |

Smoke tests de integração (repositório Drizzle real) deixados para o plano em command manual (não automatizados nesta fase).

## 12. Migração de dados

**Nenhuma migration nova esperada** — a tabela `items` e o enum `role` já existem
(migração 0000/0001, ref. fundação). O único ponto de dados é a promoção de role
via use case.

## 13. Considerações

| Tópico | Decisão |
|---|---|
| Valores monetários | sempre centavos (integer), consistentes com `money` VO |
| Transações | operações de item são atômicas; concorrência de lances é tratada no 2c |
| Segurança | server actions + validação role nos use cases (não confiar só em UI) |

## 14. Próximos sub-projetos (não fazem parte deste spec)

- **2b:** upload de imagens (imageUrl), vitrine `/{slug}`, página de item `/{slug}/{itemId}`, instância OpenAI de imagens de item.
- **2c:** place-bid com validações concorrentes, notificações outbid (Resend na fase 3), countdown, encerramento via cron, pagamentos.