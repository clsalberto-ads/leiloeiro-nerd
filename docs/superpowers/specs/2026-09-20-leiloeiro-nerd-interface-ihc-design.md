# Spec — Refinamento de Interface e Usabilidade (IHC + Conversão)

## 1. Objetivo

Elevar a interface do Leiloeiro Nerd em três dimensões, sem alterar regras de negócio:

1. **Usabilidade (IHC)** — validação por campo em tempo real, vínculo semântico erro↔campo, estados de feedback (carregando/vazio/erro), controle do usuário sobre listas (filtro/paginação/busca), acessibilidade de teclado e leitor de tela, densidade mobile com alvos de toque adequados.
2. **Conversão (marketing-skills)** — proposta de valor compreensível em <3s, CTA primário único acima do fold, prova social próxima ao ponto de decisão, hierarquia de escaneabilidade, âncoras de urgência reais (deadline/cascata).
3. **Consistência técnica** — forms com React Hook Form + Zod, listas com TanStack Table via shadcn DataTable, notificações efêmeras com sonner.

**Fora de escopo:** regras de negócio, schema do banco, APIs, pagamentos, lances. Apenas camada de apresentação e feedback.

## 2. Estado atual (diagnóstico verificado)

| # | Achado | Evidência | Custo IHC |
|---|---|---|---|
| 1 | Validação só no submit; erro em bloco único no topo | `useActionState` em todos os forms; `item-form.tsx:53` | Usuário descobre múltiplos erros por vez |
| 2 | Input sem vínculo semântico com erro | sem `aria-invalid`/`aria-describedby` | Leitor de tela não associa erro↔campo |
| 3 | Lista sem paginação, busca ou ordenação | `items-list.tsx:22` filtra só status, client-side | Sem recuperação rápida em acervos grandes |
| 4 | Landing sem estrutura de conversão | `app/page.tsx`: h1 + parágrafo + 2 botões | Sem proposta de valor, sem CTA primário |
| 5 | Sem estados de carregamento/vazio | listas renderizam vazio durante fetch | Resposta >1s sem feedback |
| 6 | Sem toast; erros efêmeros no topo do form | `item-form.tsx:49` | Mensagem some ao rolar |
| 7 | Countdown sem anúncio | `bid-countdown.tsx` altera a cada 1s | Leitor de tela não percebe mudança temporal |
| 8 | Densidade mobile insuficiente | grid `sm:grid-cols-2`; sem alvos ≥44px | Toque impreciso, formulários longos |

**Inventário:** 4 componentes shadcn (button, card, input, label) · 8 componentes de domínio · 22 páginas · 104 tokens CSS semânticos · deps: `shadcn@4.21`, `zod@4.6.4`, `lucide-react`.
**Ausentes:** react-hook-form, @hookform/resolvers, @tanstack/react-table, sonner, componentes de tabela/dialog/toast.

## 3. Decisões do usuário

- **Ordem:** fundação primeiro (Fase 1 → 2 → 3 → 4 → 5 → 6).
- **DataTable:** apenas em `/dashboard/items` (lista do seller). Vitrine pública permanece como está.

## 4. Dependências novas

```bash
pnpm add react-hook-form @hookform/resolvers
pnpm add @tanstack/react-table @tanstack/react-pagination
pnpm add sonner
```

## 5. Componentes shadcn a adicionar

| Componente | Uso |
|---|---|
| `form` | Field, FormControl, FormLabel, FormMessage, FormDescription (ligação erro↔campo) |
| `table` | Base do DataTable |
| `dropdown-menu` | Menu de ações por linha, ordenação |
| `select` | Filtro de status, tamanho de página |
| `checkbox` | Seleção de linhas |
| `popover` | Painel de filtros avançados |
| `skeleton` | Estados de carregamento |
| `sonner` (Toaster) | Notificações efêmeras |
| `alert` | Erros de form não-associated a campo |
| `separator` | Divisão visual de seções |
| `tooltip` | Ajuda contextual em ações |
| `badge` | Status unificado (substitui CSS avulso do `item-status-badge`) |

## 6. Fases e tasks

### Fase 1 — Fundação de formulários (RHF) — 5 tasks
1. Deps + componente `form` shadcn + `Toaster` (setup)
2. `field.tsx` — wrapper `Field` que renderiza Label/Input/erro com `aria-invalid` + `aria-describedby` automáticos
3. Migrar `item-form.tsx` (124 linhas) para RHF + `zodResolver(itemSchema)` reutilizando o schema da action
4. Migrar `login`, `register`, `forgot-password` forms
5. Migrar `bid-form` + `become-seller-form`

**Contrato:** erros por campo vêm do `zodResolver` sobre o schema já existente em `src/lib/validators.ts` (fonte única de verdade — sem duplicar regras).
**Comportamento:** validação em `onBlur` + `onSubmit`; `mode: "onChange"` após primeiro erro (evita这天 annoyar enquanto digita).
**Acessibilidade:** `aria-invalid="true"` no input inválido; `aria-describedby` apontando para a mensagem; erro com `role="alert"`; foco automático no primeiro campo inválido no submit.

### Fase 2 — DataTable do dashboard — 4 tasks
6. Deps TanStack + componentes shadcn (`table`, `dropdown-menu`, `select`, `checkbox`, `popover`)
7. `data-table.tsx` genérico: ordenação por coluna, filtro de texto (debounce 300ms), filtro de status, paginação, seleção
8. Estado no URL (`?status=&q=&order=&page=`) — back/forward do browser preserva estado (controle do usuário)
9. `columns.tsx` do seller (título, tipo, status, lance mínimo, lances, deadline, ações) + paginação server-side em `listSellerItems`

**Nota IHC:** o filtro atual é client-side sobre o array inteiro; passa a ser server-side com `limit/offset`, escalando para acervos grandes.

### Fase 3 — Estados e feedback — 3 tasks
10. `skeleton` em vitrine pública e listas; empty states com ação (não apenas texto)
11. `sonner` — erros de upload, sucesso de lance/pagamento, "PIX copiado"
12. `aria-live="polite"` no `BidCountdown`; `role="status"` nos badges; `prefers-reduced-motion` no countdown

### Fase 4 — Conversão (marketing-skills) — 3 tasks
13. Landing page: PAS (problema→agitação→solução→ação), **CTA primário único** acima do fold, barra de confiança, 3 passos "como funciona"
14. Vitrine `/{slug}`: prova social (contagem de itens/lotes), estado de lance em destaque, empty state com CTA
15. Página de item: hierarquia F-pattern, countdown como âncora de urgência real, sugestão de valor mínimo no botão de lance

**Anti-padrões a evitar (marketing-skills):** múltiplos CTAs concorrentes; headlines com jargão; urgência falsa.

### Fase 5 — Mobile e acessibilidade — 2 tasks
16. Alvos de toque ≥44px, forms em coluna única, tabelas→cards em viewport estreito
17. Auditoria de teclado (foco visível, ordem de tabulação, skip-link), landmarks, `main` único, textos alternativos

### Fase 6 — Validação — 2 tasks
18. Lighthouse a11y + axe scan nas páginas alteradas; contraste AA
19. Testes: RHF (submit/erro por campo), DataTable (filtro/paginação/ordenação), countdown acessível

## 7. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| RHF re-renderiza a cada tecla (Next 16) | `useActionState` preservado para submissão; RHF apenas para estado/validação de campo |
| Migração de forms quebra server actions | Schema Zod permanece em `validators.ts` como fonte única; action inalterada |
| DataTable client-side com 1000+ itens | Paginação server-side (task 9) desde o início |
| Adicionar `badge` conflita com `item-status-badge.tsx` | Migrar `item-status-badge` para o `badge` do shadcn e remover duplicata |
| Bundle cresce com TanStack | Tree-shaking; `data-table.tsx` só na rota do dashboard |

## 8. Definição de pronto

- [ ] 5 deps instaladas; 12 componentes shadcn adicionados
- [ ] 6 formulários migrados para RHF com validação por campo e acessibilidade
- [ ] `/dashboard/items` com DataTable (ordenação, busca, filtro, paginação, URL state)
- [ ] Skeletons e empty states nas listas
- [ ] Toasts para erros/sucessos; `aria-live` no countdown
- [ ] Landing e vitrine com CTA primário, proposta de valor e prova social
- [ ] Alvos de toque ≥44px; navegação por teclado completa
- [ ] axe: zero violações críticas; contraste AA
- [ ] `pnpm test` + `pnpm lint` + `npx tsc --noEmit` + `pnpm build` limpos
