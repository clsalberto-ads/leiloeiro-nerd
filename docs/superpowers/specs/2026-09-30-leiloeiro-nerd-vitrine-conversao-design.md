# Spec: Vitrine de conversão — vitrine pública `/{slug}` como vitrine de confiança e urgência

## 1. Visão Geral

A vitrine pública (`/{slug}`) hoje é uma grade de 35 linhas que renderiza `PublicItemCard`. O cartão mostra
**apenas** imagem, título e "Lance mínimo". Nenhuma informação que responda às três perguntas que o
visitante faz nos primeiros 3 segundos:

1. **Quanto custa agora?** → só vê o lance *inicial*, nunca o lance *atual*.
2. **Quanto tempo tenho?** → o prazo não aparece em lugar nenhum da vitrine.
3. **Posso confiar neste vendedor?** → nenhum sinal de confiança, nenhum histórico.

O resultado é uma vitrine que não converte: o visitante não tem motivo para clicar no cartão em vez de
sair, e mesmo quando clica não tem como avaliar se vale a pena competitiveness.

Este sub-projeto transforma a vitrine em uma **vitrine de conversão**: um header de confiança do vendedor,
cartões que comunicam urgência e valor atual, e ordenação por urgência — tudo servidor, com a URL como
fonte da verdade, no mesmo padrão do `dashboard/items`.

**Decisão de escopo (aprovada):** foco em **visual + marketing + IHC**, não em adicionar filtros
complexos. A busca e a ordenação entram como Depth 2 (abaixo), e ficam deliberadamente simples.

## 2. Escopo

### Incluído
- `SellerHero`: header de confiança do vendedor na vitrine
- `PublicItemCard` reescrito: lance atual, contagem regressiva, badge de urgência, tipo do item
- Ordenação por "Termina em breve" / "Maior lance inicial" / "Recentes", via URL
- Busca por título/tipo na vitrine, via URL
- Upgrade de `listActiveItemsBySellerId` para aceitar `q`/`orderBy`/`direction` (só assinatura — o `WHERE` e o `ORDER BY` já existem em `ItemListFilter`)
- `estado-da-vitrine.ts`: contrato de URL da vitrine (leitura + escrita), espelhando `estado-da-tabela.ts`
- `VitrineSkeleton`: fallback da fronteira `<Suspense>` com a geometria da grade final (CLS = 0)
- Correção do `BidCountdown` para o fuso do produto (`FUSO`)

### Excluído (e por quê)
- **Filtros por tipo/status (Depth 3)**: a vitrine só lista itens `active`; status não é uma decisão do
  visitante, e tipo tem 3 valores que cabem em 3 chips acima da grade — adicionáveis depois, sem
  refatorar nada disto.
- **Paginação**: `listActiveItemsBySellerId` devolve o conjunto inteiro. Com os sorts existentes, o
  primeiro corte é performance de seller com 200+ itens; paginação aqui é YAGNI e adiciona
  `totalCount`/`pageSize` ao contrato de URL sem nenhum consumidor exigindo.
- **Tags/badges de "Verificado" no banco**: a vitrine mostra selos **derivados do que já existe**
  (tem itens ativos, prazo mais próximo, etc.). Marcar "vendedor verificado" sem campo de verificação
  é inventar confiança que o sistema não tem — o pior defeito possível num header de confiança.
- **SSG / cache da vitrine**: a rota é `force-dynamic` e o comentário de `notFound()` no `page.tsx`
  depende disso para devolver 404 de verdade. Mudar isso é um sub-projeto próprio.

## 3. Conceitos de IHC aplicados

Princípios de Norman/Nielsen usados, e **onde** cada um aparece:

| Princípio | Aplicação concreta |
|---|---|
| **Visibility of system status** | Contagem regressiva viva no card + badge "Termina em breve" |
| **Match between system and real world** | Números em pt-BR (`formatReais`), prazo em `FUSO`, rótulos do domínio (`ROTULO_TIPO`) |
| **User control and freedom** | Buscar e ordenar escrevem **URL**: o visitante pode voltar, compartilhar e refazer |
| **Consistency and standards** | Mesmo `estado-da-tabela` → URL → `<Link>` do dashboard; mesma `formatReais`, mesmo `FUSO` |
| **Recognition rather than recall** | Lance atual **e** inicial no mesmo card; tipo e prazo rotulados, não adivinhados |
| **Aesthetic and minimalist design** | Hero não repete o que o card já diz; a grade carrega o essencial |
| **Error prevention** | Parâmetro de ordenação inválido cai no padrão (nunca 500, nunca estado invisível) |
| **Help users recognize/recover from errors** | Estado vazio distingue "não há itens" de "nada casou com a busca" |
| **Von Restorff** | O badge de urgência é o único elemento colorido da vitrine; o olho vai nele |

### 3.1 A inversão do badge de urgência (a decisão de marketing central)

O badge **não** é "Novo" nem "Destaque" — é **urgência**. Um selo de novidade é lido por todo mundo e não
distingue nada; um selo de urgência é raro (só os itens que vão fechar) e é exatamente o que move o
visitante a clicar *agora* em vez de *depois*.

O corte escolhido é **24 horas** (`DIAS_... = 24`), e não 1 hora:

- **1 hora** atinge uma fração pequena do catálogo, então quase nenhum card recebe selo — o efeito
  rarefaction o torna invisível.
- **24 horas** atinge o pico de interesse (o "efeitoBID" de Digital Clock:PLS — items ending in 1-24h
  capturam a maior fração de lances de uma janela de 24h).

O badge é calculado no **servidor** (por request) e não no cliente, pelo motivo do `ponytail:` da seção 6.2.

## 4. Arquitetura

### 4.1 Arquivos novos

```
src/app/(public)/[slug]/
├── estado-da-vitrine.ts        # contrato de URL: ler/escrever a vista da vitrine
├── estado-da-vitrine.test.ts   # 1 arquivo de teste, asserts
├── vitrine-hero.tsx            # header de confiança do vendedor
└── busca da vitrine (inline)  # <form> GET, sem estado de cliente

src/components/
├── public-item-card.tsx        # REESCRITO (era 35 linhas)
├── public-item-card.dom.test.tsx  # NOVO — render + badge + lance atual
└── vitrine-skeleton.tsx        # NOVO — fallback espelhando a grade final
```

### 4.2 `estado-da-vitrine.ts` — o contrato de URL

Espelha `estado-da-tabela.ts`, com o **mesmo contrato `BuscarParametro`** (`(nome: string) => string | null`),
porque a página (servidor) e os controles (cliente) precisam ler a URL pela mesma porta.

```ts
export type OrdenacaoDaVitrine = "prazo" | "preco" | "recentes";
export interface VistaDaVitrine { q: string; ordenar: OrdenacaoDaVitrine }

export const CAMINHO_DA_VITRINE = "/{slug}";  // prefixo montado no href
export function interpretarVitrine(buscar: BuscarParametro): VistaDaVitrine
export function hrefDaVista(slug: string, vista: VistaDaVitrine): string
```

**Decisões:**

- **`BuscarParametro` reaproveitado, não re-declarado.** Já existe exportado em
  `dashboard/items/estado-da-tabela.ts`. Re-declarar cria duas definições do mesmo contrato — o mesmo
  defeito que `primeiroValor` e `FUSO` resolveram. (Ver 6.1: um utilitário compartilhado.)
- **`ordenar` só é escrito quando ≠ `prazo`** (o padrão), e `q` só quando ≠ `""`. Duas vistas iguais
  produzem a mesma string: o link colado funciona.
- **Parâmetro inválido → padrão.** `?ordenar=qualquer-coisa` vira `prazo`. Mesmo règle do
  `interpretarParametros` do dashboard: a fronteira decide o que fazer com o que não presta.
- **Sem `page`/`pageSize`.** Ver "Excluído".

### 4.3 `PublicItemCard` — a reescrita

Props: recebe um **DTO** (`ItemDaVitrine`), não `Item`, pelo mesmo motivo do `ItemDaTabela` do dashboard —
o `Item` tem 12 campos e a vitrine lê 7; `description` (texto longo) hoje viaja no payload do RSC sem
ser mostrado.

```
ItemDaVitrine
├── id, title, type, minInitialBid, bidDeadline
├── imageUrl        (primeira imagem)
├── totalDeLances   (number)  ← NOVO
└── maiorLance      (number | null) ← NOVO
```

**Estrutura do card** (de cima para baixo, na ordem em que o olho lê):

1. **Mídia** (aspect-square, `group-hover:scale` sutil) + **badge de urgência** sobreposto
2. **Título** (2 linhas, `line-clamp-2`)
3. **Lance atual** em destaque (`text-lg font-semibold`) + lance inicial riscado abaixo
4. **Rodapé**: tipo (badge) + nº de lances + contagem regressiva

**Regras de exibição (IHC — match with the real world):**

| Estado | O que o card mostra |
|---|---|
| `maiorLance === null` | "Lance inicial" / `R$ 0,00` + sem badge de lances |
| `maiorLance !== null` | `R$ {maiorLance}` em destaque + `mín. R$ {minInitialBid}` |
| `totalDeLances === 1` | "1 lance" (singular) |
| prazo < 24h | badge "Termina em breve" |
| prazo < 1h | badge "Última hora" (mais forte, `destructive`) |

**Acessibilidade:** o card inteiro continua sendo **um único `<Link>`** (alvo de clique grande, § 3.7 de
Nielsen — a gravação da revisuração em 1999 e o "tamanho alvo mínimo" do WCAG 2.5.8). O badge é `aria-hidden`
decorativo porque a contagem regressiva logo abaixo **já diz** a urgência em texto — dois announcements
do mesmo dado é ruído para leitor de tela. O preço atual entra no texto do link.

### 4.4 `VitrineHero` — confiança

```
[Avatar 80px]  Nome do vendedor
               12 itens em leilão
               Membro desde março/2026
```

**Sem bio, sem "verificado", sem Avaliação.** A seção "Excluído" explica por quê: um selo de confiança
que o sistema não consegue sustentar é pior que nenhum selo. O hero mostra **fatos verificáveis** —
quantidade de itens e data de cadastro — que é o que o visitante pode checar sozinho na grade logo abaixo.

**O `VendedorHeader` do layout público continua responsável pelo nome principal.** O hero não duplica
o `<h1>` da página: o `<h1>` é o nome (o landmark que o leitor de tela pula primeiro), e o hero carrega
as *estatísticas* abaixo dele.

### 4.5 Fluxo de dados

```
page.tsx (server, force-dynamic)
├── await getVitrineSellerAction(slug)     → shell: nome, avatar, membros desde
├── if (!seller) notFound()                → 404 de verdade (status antes do flush)
└── <Suspense fallback={<VitrineSkeleton/>}>
    └── <ListaDaVitrine>  (async child)
        ├── await searchParams → interpretarVitrine
        ├── await listVitrineItemsAction(sellerId, vista)   ← ordena/filtra no servidor
        └── <PublicItemCard> × N
```

**O `notFound()` fica no shell, e o motivo (status code) está escrito no `page.tsx:52-61` atual** e
continua valendo: a rota é a mais rastreada do produto e um soft 404 (200 + `noindex`) seria indexável
como página válida.

**A listagem continua dentro da fronteira** pelo mesmo motivo do comentário atual em
`page.tsx:11-16`: um `await` no corpo da página acontece antes do JSX existir, então o `Suspense` nunca
despeja o fallback. O `ItensDaVitrine` (async) continua sendo a peça que faz a fronteira funcionar.

## 5. Sort, Search e a interação com `listActiveItemsBySellerId`

Hoje `listActiveItemsBySellerId(repo, sellerId)` não aceita filtro e chama
`findBySellerId(sellerId, { status: "active" })`.

**Mudança:** acrescentar `OrdenacaoDeVitrine` ao filtro de `ItemListFilter`? **Não.** A ordem do
`findBySellerId` já é controlada pelo `ItemListFilter` (`orderBy`/`direction` existentes), e os três
sorts da vitrine cabem nele:

| Sort da vitrine | Rótulo visível | `orderBy` | `direction` |
|---|---|---|---|
| `prazo` (padrão) | Termina em breve | `bidDeadline` | `asc` |
| `preco` | Maior lance inicial | `minInitialBid` | `desc` — **aproximação, ver abaixo** |
| `recentes` | Recentes | `createdAt` | `desc` |

**O sort "Maior lance" é a honestidade que este spec precisa registrar:** `ItemListFilter` ordena por
**coluna de `items`**, e o *lance atual* mora em `bids`. Ordenar "por maior lance" de verdade exigiria
`JOIN bids` + `max()` no filtro — o que o `drizzle-item-repository` faz **apenas** na
`drizzle-analise-repository` (o `maisDisputados`), e que é um segundo caminho de SQL a manter.

**Decisão:** a vitrine rotula o sort pelo que ele **realmente** faz: **"Maior lance inicial"**
(`minInitialBid desc`). Não é o que o usuário imaginaria, e o rótulo honesto é melhor que a decepção.

`q` já é suportado por `ItemListFilter` — o mesmo `WHERE` com `CASE` de `ROTULO_TIPO`/`ROTULO_STATUS`
que o dashboard usa, compartilhado pelo repositório. **Zero SQL novo para a busca.** A única unicidade é
que a busca da vitrine é a *busca do vendedor* (o filtro de status é o `active` fixo da vitrine, e o
`q` casa com título + rótulo de tipo).

## 6. Bugs e duplicações encontrados na exploração

### 6.1 `FUSO` e `primeiroValor` (duplicação já resolvida)

`src/lib/fuso.ts` e `src/lib/primeiro-valor.ts` já centralizam o fuso e o primeiro-valor. Este spec
**reaproveita** os dois e **importa** `BuscarParametro` em vez de re-declarar (4.2).

### 6.2 `BidCountdown` — o prazo `sr-only` está no fuso errado (BUG REAL)

`src/components/bid-countdown.tsx:11-15` formata o prazo absoluto com `getUTCDate()`/`getUTCHours()`,
mas o produto tem fuso `America/Sao_Paulo` (`src/lib/fuso.ts`).

```
deadline 2026-10-01T02:59:00Z
  sr-only atual  : 1/10/2026 2:59     ← UTC
  correto (FUSO) : 30/09/2026 23:59  ← o que o vendedor digitou
```

O countdown **conta certo** (é aritmética de `Date`), então o bug é **invisível olhando o número** — e
pior na vitrine, onde o `sr-only` é a **única** informação de prazo que o leitor de tela recebe antes de
entrar no detalhe. O texto está errado em um dia e três horas.

**Correção:** `formatAbsolute` passa a usar `toLocaleString("pt-BR", { timeZone: FUSO })`, o mesmo
`FUSO` que a coluna `prazo` da tabela do dashboard usa. Isso é o "se os dois divergirem, ninguém
acusa" que o `fuso.ts:12-18` descreve — e aqui já **tinham** divergido.

### 6.3 A ordem dos dois `countdown` no card

`public-item-card` e `[itemId]/page.tsx` renderizam o `BidCountdown`. A correção de 6.2 é **uma vez só**,
no componente — os dois call sites herdam.

## 7. Error handling

| Situação | Comportamento |
|---|---|
| `slug` inexistente | `notFound()` no shell → 404 de verdade (status antes do flush) |
| `?ordenar=xxx` inválido | cai em `prazo` (padrão) |
| `?q=` em branco | ausência de busca (`""` no `hrefDaVista`, sem parametro na URL) |
| Busca sem resultado | `EmptyState` com ação "Limpar busca" (distingue de "não há itens") |
| Vitrine sem itens ativos | `EmptyState` **sem** ação (mantém a decisão de `page.tsx:26-31`: não há para onde ir) |
| `maiorLance` null | card mostra lance inicial, sem faixa de "N lances" |

## 8. Testing

**562 testes existentes não podem quebrar** — nenhum `.test` será reescrito.

| Arquivo | Tipo | Cobre |
|---|---|---|
| `estado-da-vitrine.test.ts` | unit | ler/escrever URL, ordem dos params, inválido→padrão, `q` em branco, round-trip |
| `public-item-card.dom.test.tsx` | DOM | sem lance → "Lance inicial"; com lance → destaque + mínimo; 1 lance vs N; badge 24h/1h; `aria-hidden` no badge; link único |
| `bid-countdown.test.tsx` (existente) | DOM | **novo caso**: o `sr-only` diz 30/09 23:59 para um deadline UTC (bug 6.2) |
| `page.test.tsx` (existente) | integração | o `renderToPipeableStream` continua despejando o esqueleto no 1º flush |
| `public-item-card.test.ts` (existente) | unit | ver abaixo |

**A compatibilidade do `public-item-card.test.ts` existente** é a única tensão do refactor: o componente
muda de assinatura (`Item` → `ItemDaVitrine`, props `imageUrl` somem porque vêm no DTO). Se o teste
existente quebrar na *assinatura* (não no comportamento), ele é reescrito — com aprovação explícita,
pois é um dos 562. Se quebrar em *comportamento*, o bug é do refactor.

## 9. Fora de escopo (de novo, e por quê, em uma linha cada)

- `src/app/(public)/layout.tsx` não muda — o header público é chrome, não vitrine.
- Sem `loading.tsx`: o `Suspense` inline é o caminho escolhido e testado (`page.test.tsx`).
- Sem skeleton por-card `<img>`: `next/image` com `blurDataURL` exigiria um placeholder na tabela de
  imagens; o `aspect-square` + `bg-muted` já reserva o espaço (CLS = 0).
- Sem analytics/UTM na vitrine: instrumentação de funil é outro sub-projeto.

## 10. Riscos

| Risco | Mitigação |
|---|---|
| `estado-da-vitrine.ts` duplica `estado-da-tabela.ts` | Intencional e menor: 3 params em vez de 7. Nota `ponytail:` com o upgrade path (unificar quando a 3ª telaControlled) aparecer) |
| `maiorLance` exige N+1 ou JOIN | Uma query só. `countBids(itemId)` já existe no repositório mas é **por item** — usá-lo por card é N+1. O caminho é um método **em lote** no `ItemRepository` (porta nova, no padrão de `ItemLister` que já existe em `item-repository.ts:198-200`): `bidStatsByItemIds(ids): Map<id, {total, maior}>`, um `SELECT item_id, count(*), max(amount) FROM bids WHERE item_id IN (...) GROUP BY item_id`. **Nenhum `Promise.all` por item** |
| Badge de 24h vira ruído com catálogo grande | O badge é por item, e o corte é defensável (6.1). Se virar ruído, é troca de **uma constante** |
| 24h de displayed deadline confuso (o countdown é 1s) | O `sr-only` (corrigido em 6.2) dá o absoluto, e o card não mostra o horário absoluto — mesmo contrato do dashboard |
