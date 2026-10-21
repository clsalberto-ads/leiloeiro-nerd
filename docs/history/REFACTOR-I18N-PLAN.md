# Plano de Refatoração: Padronização de Idioma (EN/PT-BR)

## Objetivo
Migrar todo o código (identificadores, nomes de arquivos, tipos, funções, variáveis) para **inglês**, mantendo:
- **Comentários** em português do Brasil (explicações, "ponytail", decisões de arquitetura)
- **Strings de UI** visíveis ao usuário final em português do Brasil
- **Nomes de testes** em português do Brasil (apenas identificadores auxiliares e código sob teste vão para inglês)

---

## Escopo da Análise (estado atual)

### Estado inicial (antes da migração) — arquivos com nomes em PT (~80+)
> Snapshot do ponto de partida. Os nomes abaixo foram renomeados; ver o dicionário
> e o status de fases no fim do documento.
```
src/app/(public)/[slug]/
  estado-da-vitrine.ts/.test.ts
  controles-da-vitrine.tsx/.dom.test.tsx
  vitrine-hero.tsx/.dom.test.tsx

src/app/(dashboard)/dashboard/items/
  estado-da-tabela.ts/.test.ts
  item-da-tabela.ts/.test.ts
  abas-de-status.tsx
  colunas.tsx
  items-list.tsx

src/app/(dashboard)/dashboard/periodo/
  periodo.ts/.test.ts
  periodo-select.tsx

src/application/use-cases/
  get-vitrine-seller.ts/.test.ts
  list-vitrine.ts/.test.ts

src/components/
  data-table.estado-vazio.test.tsx
```

### Identificadores PT em código (amostra)
| Categoria | Exemplos |
|-----------|----------|
| **Types/Interfaces** | `VistaDaVitrine`, `OrdenacaoDaVitrine`, `ItemDaTabela`, `VistaDaTabela`, `PapelDoUsuario` |
| **Constants** | `LISTA_DE_ORDENACOES`, `VISTA_PADRAO_DA_VITRINE`, `CAMINHO_DA_LISTA`, `TAMANHO_DE_PAGINA_PADRAO` |
| **Functions** | `interpretarVitrine`, `hrefDaVista`, `paraItemDaTabela`, `ehOrdenacao` |
| **Variables** | `ordenar`, `termo`, `partes`, `chave`, `dias` |

### Strings de UI (MANTER em PT-BR) ✅
- "Nenhum item encontrado"
- "Nenhum item em leilão"
- "Leilão encerrado"
- "Lance mínimo R$ 1,00"
- Labels, placeholders, toasts, mensagens de erro voltadas ao usuário

### Comentários (MANTER em PT-BR) ✅
- `// ponytail: ...` — decisões de arquitetura
- Comentários explicativos de regras de negócio
- Documentação de edge cases

---

## Estratégia de Migração

### Princípios
1. **Uma migração por PR** — cada área lógica isolada
2. **Testes passam em cada step** — `pnpm vitest run` + `pnpm typecheck` + `pnpm lint` + `pnpm build`
3. **Renomear arquivos + imports + identificadores juntos** — evitar quebras intermediárias
3. **Git history preservado** — `git mv` para renomear arquivos
4. **Sem breaking changes em APIs públicas** — se houver, versionar

### Ordem de Prioridade (menor risco → maior risco)

| Fase | Área | Arquivos estimados | Risco |
|------|------|-------------------|-------|
| **1** | `src/lib/`, `src/domain/value-objects/`, `src/domain/repositories/` (tipos puros) | ~15 | Baixo |
| **2** | `src/application/use-cases/` (casos de uso core) | ~35 | Médio |
| **3** | `src/presentation/actions/` (server actions) | ~12 | Médio |
| **4** | `src/infrastructure/` (repositórios, DB) | ~10 | Médio |
| **5** | `src/app/(dashboard)/dashboard/` (painel admin) | ~25 | Alto |
| **6** | `src/app/(public)/[slug]/` (vitrine pública) | ~15 | Alto |
| **7** | `src/components/` (UI compartilhada) | ~20 | Alto |
| **8** | `src/app/(auth)/` + root layouts | ~8 | Baixo |

---

## Mapeamento de Nomes (Dicionário)

### Tipos/Interfaces
| PT (atual) | EN (aprovado) |
|------------|---------------|
| `VistaDaVitrine` | `StorefrontView` |
| `OrdenacaoDaVitrine` | `StorefrontSort` |
| `ItemDaVitrine` | `StorefrontItem` |
| `ItemDaTabela` | `DashboardItemRow` |
| `VistaDaTabela` | `DashboardTableView` |
| `PapelDoUsuario` | `UserRole` (já existe em user-repository) |
| `EstatisticasDeLances` | `BidStatsList` |
| `EstatisticasDeLance` | `BidStats` |
| `ResumoDoVendedor` | `SellerSummary` |
| `ResumoDoComprador` | `BuyerSummary` |
| `SeriesDoVendedor` | `SellerSeries` |
| `VisaoDoVendedor` | `SellerView` |
| `VisaoDoComprador` | `BuyerView` |
| `VisaoDoDashboard` | `DashboardView` |

### Funções
| PT (atual) | EN (aprovado) |
|------------|---------------|
| `interpretarVitrine` | `parseStorefrontView` |
| `hrefDaVista` | `buildStorefrontHref` |
| `hrefDoPeriodo` | `buildPeriodHref` |
| `interpretarPeriodo` | `parsePeriod` |
| `paraItemDaTabela` | `toDashboardItemRow` |
| `ehOrdenacao` | `isValidSort` |
| `contarItens` | `formatItemCount` |
| `janela` | `clampWindowDays` |
| `dinheiroInvalido` | `invalidMoney` |
| `diasDePagamentoInvalidos` | `invalidPaymentDays` |
| `erroDePerfil` | `profileError` |
| `mensagemDeErro` | `toActionError` |

### Constantes
| PT (atual) | EN (aprovado) |
|------------|---------------|
| `LISTA_DE_ORDENACOES` | `STOREFRONT_SORT_OPTIONS` |
| `VISTA_PADRAO_DA_VITRINE` | `DEFAULT_STOREFRONT_VIEW` |
| `CAMINHO_DA_LISTA` | `DASHBOARD_ITEMS_PATH` |
| `DIRECAO_DA_VISTA_PADRAO` | `DEFAULT_SORT_DIRECTION` |
| `ORDENACAO_PADRAO` | `DEFAULT_SORT_BY` |
| `TAMANHO_DE_PAGINA_PADRAO` | `DEFAULT_PAGE_SIZE` |
| `TAMANHO_DE_PAGINA_MAXIMO` | `MAX_PAGE_SIZE` |
| `ROTULOS_DA_ORDENACAO` | `SORT_LABELS` |
| `ROTULO_STATUS` | `STATUS_LABELS` |
| `ROTULO_TIPO` | `TYPE_LABELS` |

### Variáveis (contexto local)
| PT | EN |
|----|----|
| `ordenar` | `sortBy` |
| `termo` | `searchTerm` |
| `chave` | `periodKey` |
| `dias` | `windowDays` |
| `papel` | `role` |
| `vista` | `view` / `tableView` |
| `slug` | `slug` (já é inglês) |

### Termos de Domínio (aprovados)
| PT | EN |
|----|----|
| `vitrine` | `storefront` |
| `leilao` | `auction` |
| `lance` | `bid` |
| `arrematante` | `bidder` / `buyer` |
| `vendedor` | `seller` |
| `item` | `item` (já é inglês) |

---

## Regras de Estilo (pós-migração)

### Código (EN)
- **PascalCase**: Types, Interfaces, Components (`StorefrontView`, `BidForm`)
- **camelCase**: Functions, variables, constants (`parseStorefrontView`, `defaultView`)
- **SCREAMING_SNAKE_CASE**: True constants (`MAX_PAGE_SIZE`, `SORT_OPTIONS`)
- **Arquivos**: kebab-case para utils, PascalCase para components (`storefront-view.ts`, `BidForm.tsx`)

### Comentários (PT-BR)
- Início com `// ponytail:` para decisões de arquitetura
- Frases completas, acentuação correta
- Explicam "porquê", não "o quê"

### Strings de UI (PT-BR)
- Extraídas para constants ou i18n futuro
- Não hardcoded em lógica de negócio

---

## Checklist por PR (Template)

```markdown
## Fase X: [Área]

### Alterações
- [ ] `git mv` arquivos PT → EN
- [ ] Renomear exports/types/functions/variables
- [ ] Atualizar imports em todo o código
- [ ] Atualizar testes (apenas assertions/imports; **nomes dos testes mantêm pt-BR**)
- [ ] Comentários: manter PT-BR, **adicionar comentários descrevendo o que cada pedaço do código faz**, corrigir referências a nomes antigos

### Verificação
- [ ] `pnpm vitest run` → 100% pass
- [ ] `pnpm typecheck` → 0 erros
- [ ] `pnpm lint` → 0 erros
- [ ] `pnpm build` → success
- [ ] Smoke manual: rotas públicas + dashboard

### Rollback
- `git revert <commit>` se quebrar algo inesperado
```

---

## Estimativa de Esforço

| Fase | Arquivos | Horas estimadas | Dependências |
|------|----------|-----------------|--------------|
| 1. Domain/Lib | ~15 | 3-4h | Nenhuma |
| 2. Use Cases | ~35 | 6-8h | Fase 1 |
| 3. Actions | ~12 | 3-4h | Fase 2 |
| 4. Infrastructure | ~10 | 2-3h | Fase 2 |
| 5. Dashboard | ~25 | 6-8h | Fases 1-3 |
| 6. Public/Vitrine | ~15 | 4-5h | Fases 1-3 |
| 7. Components | ~20 | 5-6h | Fases 1-3 |
| 8. Auth/Root | ~8 | 1-2h | Nenhuma |
| **Total** | **~140** | **30-40h** | — |

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Quebra de import não detectada | Média | Alto | Typecheck + build em cada PR |
| Conflito de merge com branch ativa | Baixa | Médio | Fazer em branch dedicada, rebase frequente |
| Strings de UI vazadas em código | Média | Baixo | Grep por PT em código não-comentário pós-migração |
| Nomes EN inconsistentes | Média | Médio | Dicionário aprovado + revisão de PR |
| Testes frágeis (snapshot/integração) | Baixa | Médio | Atualizar snapshots, testes de integração rodam em CI |

---

## Próximos Passos

1. **Aprovar dicionário** — revisar mapeamentos acima
2. **Criar branch** `refactor/i18n-code-en` a partir de `main`
3. **Iniciar Fase 1** (domain/lib) — menor risco, valida pipeline
4. **Code review** de cada PR por pelo menos 1 pessoa
5. **Merge incremental** para `main` após cada fase validada

---

## Decisões Aprovadas

1. **Testes**: nomes em **pt-BR** (manter português nos nomes de testes e assertions)
2. **`slug`**: termo técnico universal — **manter**
3. **`vitrine`** → **`storefront`** (padrão SaaS/e-commerce internacional)
4. **`leilao`/`lance`** → **`auction`/`bid`** (padrão e-commerce internacional)
5. **Comentários `ponytail:`**: manter **pt-BR** e **adicionar comentários descrevendo o que cada pedaço do código faz** (documentação inline mais rica)

---

## Status das Fases

| Fase | Área | Status |
|------|------|--------|
| **1** | `src/lib/`, domain types, repositories | ✅ concluída |
| **2** | `src/application/use-cases/` | ✅ concluída |
| **3** | `src/presentation/actions/` | ✅ concluída |
| **4** | `src/infrastructure/` + dashboard/analytics | ✅ concluída |
| **5** | Dashboard (charts, period, items) | ✅ concluída |
| **6** | `src/app/(public)/[slug]/` storefront | ✅ concluída |
| **7** | `src/components/` | ✅ concluída |
| **8** | `src/app/(auth)/` + root layouts | ✅ concluída |

Gate final: `719 testes / 74 arquivos` passando, `tsc --noEmit` limpo, lint com
`0 erros / 33 warnings` (baseline pré-existente), build de produção OK.

### Contratos externos preservados
- Query string pública da vitrine: `?ordenar=...` e `?periodo=...`
- `notification_type` no banco: `outbid`, `won`, `payment_due`, `payment_expired`,
  `payment_confirmed`
- `STOREFRONT_SORT_OPTIONS` mantém os valores `prazo`, `lance`, `recentes`

---

**Status**: migração concluída nas 8 fases, com todos os gates validados.