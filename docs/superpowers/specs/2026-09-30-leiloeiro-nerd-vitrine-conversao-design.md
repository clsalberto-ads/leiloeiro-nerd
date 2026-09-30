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

**Decisões de produto (pedidas explicitamente, e aplicadas em todo o documento):**

1. **O sort "Maior lance" ordena pelo lance ATUAL, real** — e o item de maior lance fica **sempre na
   primeira posição** desse sort. Isso exige cruzar `bids` no caminho de dados (seção 5), porque o lance
   atual não mora em `items`.
2. **O bug de fuso do `BidCountdown` é corrigido** (seção 6.2) — o prazo em `sr-only` está um dia e
   três horas errado.
3. **Sem selo "Verificado" e sem paginação** (seção "Excluído") — só fatos verificáveis, e paginação
   adiada até existir vendedor com catálogo que a peça.
4. **O badge de urgência de 24h e a inversão Von Restorff** (§ 3.1) seguem como especificado.

**A ambiguidade de "sempre na primeira posição", resolvida:** a frase admite duas leituras — (i) *dentro
do sort "Maior lance", o maior lance fica no topo*; (ii) *um item fica fixo no topo da vitrine,
independente do sort*. Adotada a **(i)**, porque a (ii) contradiz a ordenação que o visitante acabou de
escolher: se ele pediu "Recentes" e vê um item preso no topo, a tela desmente a URL. A (i) também é
verificável por um teste sem ambiguidade (o primeiro card é o de maior `maiorLance`).

## 2. Escopo

### Incluído
- `SellerHero`: header de confiança do vendedor na vitrine
- `PublicItemCard` reescrito: lance atual, contagem regressiva, badge de urgência, tipo do item
- Ordenação por "Termina em breve" / "Maior lance" (lance **atual** real) / "Recentes", via URL
- Busca por título/tipo na vitrine, via URL
- `estado-da-vitrine.ts`: contrato de URL da vitrine (leitura + escrita), espelhando `estado-da-tabela.ts`
- `list-vitrine.ts`: use case novo que cruza itens + estatísticas de lance e **ordena** (seção 5)
- `EstatisticasDeLances`: porta nova no domínio, uma query em lote (seção 5.3) — sem N+1
- `VitrineSkeleton`: fallback da fronteira `<Suspense>` com a geometria da grade final (CLS = 0)
- Correção do `BidCountdown` para o fuso do produto (`FUSO`) — bug real, seção 6.2

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
└── vitrine-hero.tsx            # header de confiança do vendedor

src/application/use-cases/
├── list-vitrine.ts             # NOVO — cruza itens + estatísticas e ordena
└── list-vitrine.test.ts        # unit puro (fakes), sem DOM

src/domain/repositories/
└── bid-repository.ts           # + EstatisticasDeLances (porta NOVA separada, seção 5.3)

src/components/
├── public-item-card.tsx            # REESCRITO (era 35 linhas)
├── public-item-card.dom.test.tsx   # NOVO — render + badge + lance atual
└── vitrine-skeleton.tsx            # NOVO — fallback espelhando a grade final
```

**Onde mora o `ItemDaVitrine` — e por que NÃO fica com o use case.** O `ItemDaTabela` do dashboard mora
em `src/app/(dashboard)/dashboard/items/item-da-tabela.ts` **ao lado do seu consumidor**, porque o
consumidor é um componente de `src/app`. Aqui o consumidor primário é o **use case**, que vive em
`src/application/` — e um `use case` importando de `src/app/` é a seta da Clean Architecture virada.

Então o DTO vai em **`src/domain/repositories/item-repository.ts`**, ao lado de `Item` e `ItemListFilter`:
é um tipo do domínio (a projeção da vitrine de um `Item`), e o componente de `src/app` pode consumi-lo
lendo para baixo, que é o sentido permitido.

**`EstatisticasDeLances` é uma interface nova, e não um método a mais em `BidRepository`.** O mesmo
raciocínio de `ItemLister` (`item-repository.ts:188-200`), e pelo mesmo motivo concreto: `BidRepository`
tem métodos que **gravam** (`placeBid`, `cancelBidByItem`); a vitrine só **lê** um agregado. Uma porta
separada deixa explícito que a vitrine depende de leitura, e — o que importa no curto prazo — os fakes
de `BidRepository` nos testes de `placeBid` (que gravam) não recebem um método a implementar.

### 4.2 `estado-da-vitrine.ts` — o contrato de URL

Espelha `estado-da-tabela.ts`, com o **mesmo contrato `BuscarParametro`** (`(nome: string) => string | null`),
porque a página (servidor) e os controles (cliente) precisam ler a URL pela mesma porta.

```ts
export type OrdenacaoDaVitrine = "prazo" | "lance" | "recentes";
export interface VistaDaVitrine { q: string; ordenar: OrdenacaoDaVitrine }

export function interpretarVitrine(buscar: BuscarParametro): VistaDaVitrine
export function hrefDaVista(slug: string, vista: VistaDaVitrine): string
```

O `slug` entra no `hrefDaVista` (e não numa constante `CAMINHO_DA_VITRINE` com placeholder
`"/{slug}"`): o caminho é `/` + slug + query, e um placeholder entre aspas seria uma string que
`hrefDaVista` teria de substituir —regex, no fim das contas.

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
o `Item` tem 12 campos e a vitrine carrega **6** deles (mais 2 que só existem no DTO); `description`, o
texto longo, hoje atravessa o payload do RSC sem ser mostrado.

```
ItemDaVitrine
├── id, title, type, minInitialBid, bidDeadline
├── imageUrl        (primeira imagem)
├── totalDeLances   (number)         ← NOVO
└── maiorLance      (number | null)  ← NOVO
```

`ItemDaVitrine` é declarado em **`src/domain/repositories/item-repository.ts`**, ao lado de `Item` e
`ItemListFilter` (ver 4.1 para o porquê do domínio, e o contraste com o `ItemDaTabela` do dashboard).

**O `maiorLance` do DTO e o `maiorLance` do sort são o mesmo número.** A query em lote alimenta os dois,
e essa é a razão de a ordenação ser em JS (seção 5.2): o valor que decide a posição é exatamente o
mesmo que o card exibe, e não há como os dois divergirem porque não são calculados duas vezes.

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
        ├── await listVitrine(itemRepo, lancesRepo, sellerId, vista)
        │     ├── findBySellerId(sellerId, { status: "active", q })   ← filtra no SQL
        │     ├── deVariosItens(ids)                                  ← 1 query em lote
        │     └── ordena por vista.ordenar                            ← ordena em JS
        └── <PublicItemCard item={itemDaVitrine} /> × N
```

**O `notFound()` fica no shell, e o motivo (status code) está escrito no `page.tsx:52-61` atual** e
continua valendo: a rota é a mais rastreada do produto e um soft 404 (200 + `noindex`) seria indexável
como página válida.

**A listagem continua dentro da fronteira** pelo mesmo motivo do comentário atual em
`page.tsx:11-16`: um `await` no corpo da página acontece antes do JSX existir, então o `Suspense` nunca
despeja o fallback. O `ItensDaVitrine` (async) continua sendo a peça que faz a fronteira funcionar.

## 5. Sort, Search e as estatísticas de lance

### 5.1 O que o repositório já faz, e o que ele não faz

`listActiveItemsBySellerId(repo, sellerId)` chama `findBySellerId(sellerId, { status: "active" })`, que
sabe filtrar por `q` e ordenar por **coluna de `items`** (`orderBy`/`direction`).

`q` continua indo para o SQL: é o mesmo `WHERE` com `CASE` de `ROTULO_TIPO`/`ROTULO_STATUS` que o
dashboard usa, e o `q` da vitrine é *a busca do vendedor* (status `active` fixo, casa com título +
rótulo de tipo). **Zero SQL novo para a busca.**

### 5.2 "Maior lance" — a decisão (pedido explícito: o maior lance tem SEMPRE a primeira posição)

O *lance atual* mora em `bids`, não em `items`. `ItemListFilter` **não sabe ordenar por ele**, e as três
saídas possíveis eram:

| Saída | Custo | Veredito |
|---|---|---|
| (a) Rótulo honesto "Maior lance inicial" (`minInitialBid desc`) | zero SQL | **Rejeitada** — o usuário pediu o lance real |
| (b) `ORDER BY (SELECT max(amount) …) DESC` dentro do filtro | SQL novo, 1 subquery/item | Possível, mas cria um **segundo** caminho de SQL de lances |
| (c) Buscar o conjunto e ordenar na aplicação | um `Map` em memória | **Escolhida** |

**Escolhida a (c), e a razão é o teto, não a preguiça.** A vitrine **não tem paginação** (decisão sua,
seção "Excluído"), então ela **já carrega o conjunto inteiro** em memória hoje. Ordenar em JS custa
`O(n log n)` sobre um array que já está na mão, e — o ponto que decide — o `maiorLance` **já é buscado
de qualquer forma**, porque o card da vitrine precisa dele para mostrar o lance atual. Ou seja:

> **Os dados necessários para ordenar por lance atual já são carregados. Ordenar por eles é
> `Array.prototype.sort`.**

A (b) pagaria uma subquery por item para reordenar **um array que já está na memória**. E criaria dois
mecanismos para o mesmo dado (SQL ordena lance, SQL busca lance) que podem divergir.

**Consequência aceita:** a ordenação da vitrine é feita em um lugar só (o use case), não no SQL. Três
sorts que antes iam para o banco agora vão para o JS. Em troca, nenhum dos três pode divergir do que o
card mostra — que é a propriedade que a seção 6.2 do `fuso.ts` descreve como o defeito a evitar.

> `ponytail:` o teto é o conjunto inteiro em memória. Um vendedor com 5.000 itens ativos paga `5000`
> linhas + `5000` chaves de mapa por request, e o `sort` em JS perde o índice do banco. O upgrade path,
> quando esse número incomodar, é a (b) — um `JOIN … GROUP BY` no repositório, movendo a ordenação de
> volta para o SQL. Nada além do sort muda quando isso acontecer: o `VistaDaVitrine` e o
> `hrefDaVista` continuam iguais.

### 5.3 A porta nova: estatísticas de lance em lote

O card precisa de `totalDeLances` e `maiorLance` por item. `ItemRepository.countBids(itemId)` **já
existe** (`item-repository.ts:209`) mas é **por item** — usá-lo por card é N+1, e a vitrine é a rota
pública mais rastreada do produto.

Nova porta, no **mesmo padrão de `ItemLister`** que já está em `item-repository.ts:188-200` (interface
separada e estreita, justificada ali por custo de contrato):

```ts
export interface EstatisticasDeLance { total: number; maior: number | null }

export interface EstatisticasDeLances {
  deVariosItens(itemIds: string[]): Promise<Map<string, EstatisticasDeLance>>;
}
```

Uma query: `SELECT item_id, count(*), max(amount) FROM bids WHERE item_id IN (…) GROUP BY item_id`.
O `Map` cobre só os itens **que têm lance** — a ausência no mapa *é* o `maiorLance === null`, então o
DTO não precisa de um segundo sinalizador.

`countBids` **fica** onde está: tem outros consumidores, e removê-lo seria churn sem ganho.

### 5.4 O use case novo, e por que não é o `listActiveItemsBySellerId`

`listActiveItemsBySellerId` tem 3 linhas, 1 parâmetro e **1 teste** (`list-active-items-by-seller.test.ts`,
3 casos) que não pode ser reescrito. Ele devolve `Item[]` e pronto.

O que a vitrine precisa é `ItemDaVitrine[]` **já ordenada**, o que significa cruzar `items` com as
estatísticas de lance. Isso é um caso de uso novo, não uma extensão do antigo:

```
src/application/use-cases/list-vitrine.ts      # NOVO — cruza itens + estatísticas e ordena
```

`listActiveItemsBySellerId` fica **intocado** — ele continua sendo o que o `getSellerVitrineAction` e o
`public-actions.test.ts` (contrato fixado) usam.

### 5.5 A ordenação, e o `null` que vai para o fim

| `ordenar` | Rótulo visível | Comparador | `null` (sem lance) |
|---|---|---|---|
| `prazo` (padrão) | Termina em breve | `bidDeadline` asc | irrelevante |
| `lance` | **Maior lance** | `maiorLance` **desc** | **vai para o fim** |
| `recentes` | Recentes | `createdAt` desc | irrelevante |

**O `null` por último é a parte que faz "o maior lance tem sempre a primeira posição" ser verdade.** Um
item sem lance algum não tem lance atual, e um item sem lance no topo de "Maior lance" seria a tela
dizendo o oposto do que o rótulo promete. `maiorLance === null` é ordenado como `-Infinity`, o que
resolve com o comparador normal — **sem `if` no comparador**.

Empate em `maiorLance` (dois itens com o mesmo maior lance — impossível hoje, já que `placeBid` valida o
incremento, mas o comparador não pode depender disso) desempata por `bidDeadline` asc, que é a ordem
que o resto da tela usa. Estável e total.

### 5.6 Nomenclatura: `preco` → `lance`

O parâmetro se chama **`ordenar=lance`**, não `preco`. "Preço" é o lance *inicial* neste produto
(`minInitialBid`); o que a vitrine ordena é o lance *atual*. `?ordenar=preco` seria o nome do campo
errado na URL — e a URL é o contrato público desta tela.

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
| `maiorLance` null | card mostra lance inicial, sem faixa de "N lances"; no sort `lance`, vai para o **fim** |
| `deVariosItens([])` | `Map` vazio, sem query — a vitrine sem itens não abre uma consulta inútil |
| A query de lote falha | o erro sobe; a vitrine é rota pública rastreada e um grid vazio silencioso seria pior que erro |

## 8. Testing

**562 testes existentes não podem quebrar** — nenhum `.test` será reescrito, exceto o caso de
assinatura registrado abaixo (e só com aprovação explícita).

| Arquivo | Tipo | Cobre |
|---|---|---|
| `estado-da-vitrine.test.ts` | unit | ler/escrever URL, ordem dos params, inválido→padrão, `q` em branco, round-trip, `ordenar=lance` |
| `list-vitrine.test.ts` | unit | **o `null` vai para o fim**; `lance` desc; desempate por prazo; `prazo` asc; `recentes` desc; `maiorLance` do mapa entra no DTO; `[]` não chama o repositório |
| `public-item-card.dom.test.tsx` | DOM | sem lance → "Lance inicial"; com lance → destaque + mínimo; 1 lance vs N; badge 24h/1h; `aria-hidden` no badge; link único |
| `drizzle-bid-repository.test.ts` (existente) | unit | **novo caso**: `deVariosItens` agrupa e devolve `Map` (2 itens, um sem lance) |
| `bid-countdown.test.tsx` (existente) | DOM | **novo caso**: o `sr-only` diz 30/09 23:59 para um deadline UTC (bug 6.2) |
| `page.test.tsx` (existente) | integração | o `renderToPipeableStream` continua despejando o esqueleto no 1º flush |
| `public-item-card.test.ts` (existente) | unit | ver abaixo |

**Testes novos não exigem framework de DOM** — o padrão do repo é `vitest` + `jsdom` e os `.dom.test.tsx`
já existentes mostram o padrão. O `list-vitrine.test.ts` é **unit puro** (fakes de repositório), sem DOM.

**A compatibilidade do `public-item-card.test.ts` existente** é a única tensão do refactor: o componente
muda de assinatura (`Item` → `ItemDaVitrine`, props `imageUrl` somem porque vêm no DTO). Se o teste
existente quebrar na *assinatura* (não no comportamento), ele é reescrito — com aprovação explícita,
pois é um dos 562. Se quebrar em *comportamento*, o bug é do refactor.

## 9. Fora de escopo (de novo, e por quê, em uma linha cada)

- `src/app/(public)/layout.tsx` não muda — o header público é chrome, não vitrine.
- `listActiveItemsBySellerId` não muda — `getSellerVitrineAction` e `public-actions.test.ts` dependem
  do contrato dele (seção 5.4).
- Sem `loading.tsx`: o `Suspense` inline é o caminho escolhido e testado (`page.test.tsx`).
- Sem skeleton por-card `<img>`: `next/image` com `blurDataURL` exigiria um placeholder na tabela de
  imagens; o `aspect-square` + `bg-muted` já reserva o espaço (CLS = 0).
- Sem analytics/UTM na vitrine: instrumentação de funil é outro sub-projeto.
- **Sem item "destaque" fixo no topo** (o que a leitura alternativa de "o maior lance tem sempre a
  primeira posição" poderia significar): um item preso ao topo contradiz a ordenação escolhida pelo
  visitante — se ele ordenou por "Recentes", o item fixo é um recado que a URL não explica. A leitura
  adotada é "dentro do sort `lance`, o maior lance é o primeiro", e a spec a aplica sem exceção.

## 10. Riscos

| Risco | Mitigação |
|---|---|
| `estado-da-vitrine.ts` duplica `estado-da-tabela.ts` | Intencional e menor: 3 params em vez de 7. Nota `ponytail:` com o upgrade path (unificar quando a 3ª tela controlada aparecer) |
| Ordenar em JS perde o índice do banco | Aceito: a vitrine **já** carrega o conjunto inteiro (sem paginação), então o `ORDER BY` não evita nenhuma leitura. `ponytail:` na seção 5.2 nomeia a porta de saída (mover para `JOIN … GROUP BY` no repositório) |
| `deVariosItens` é uma porta nova no domínio | Segue o precedente de `ItemLister` (`item-repository.ts:188-200`), que já existe pelo mesmo motivo de custo de contrato. Interface separada, não mais um método em `ItemRepository` — assim os 11 fakes de teste não quebram |
| Badge de 24h vira ruído com catálogo grande | O badge é por item, e o corte é defensável (3.1). Se virar ruído, é troca de **uma constante** |
| Contagem regressiva em 12 cards = 12 `setInterval` | 12 timers de 1s é o custo de uma vitrine viva, e `bid-countdown.tsx:19-22` já limpa no unmount. Aceito. Se a vitrine passar de ~50 itens, o `ponytail:` aqui vira agrupar por minuto |
| `sr-only` do prazo (bug 6.2) corrigido pode quebrar o teste existente | O caso novo **afirma** a correção; se o antigo afirmar o UTC, ele é o bug e muda |
