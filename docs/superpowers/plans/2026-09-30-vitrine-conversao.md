# Vitrine de Conversão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a vitrine pública `/{slug}` em uma vitrine de conversão — hero de confiança, cards com lance atual e urgência, ordenação por lance real — com a URL como fonte da verdade.

**Architecture:** A vitrine passa a ser servida por um use case novo (`list-vitrine`) que cruza `items` com um agregado de lances (**uma** query em lote, `GROUP BY item_id`) e ordena em JS. A ordenação é em JS porque a vitrine não pagina (carrega o conjunto inteiro) e porque o `maiorLance` é buscado de qualquer forma para o card — o número que decide a posição é literalmente o mesmo que o card exibe.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Drizzle ORM + Postgres 17, Tailwind CSS v4, shadcn/Base UI, Recharts, Vitest + jsdom, Lucide.

**Spec:** `docs/superpowers/specs/2026-09-30-leiloeiro-nerd-vitrine-conversao-design.md`

---

## Global Constraints

- **Nenhum caso de teste existente pode ter suas ASSERÇÕES ou sua INTENÇÃO alteradas.** A restrição
  protege o *significado* do caso, não o identificador dele. Então: acrescentar casos NOVOS a um
  arquivo `.test` que o brief nomeia é permitido e esperado (é o que Task 3, Task 6 e Task 10
  fazem); renomear um caso cujo **nome** é defeituoso (anglicismo, ou nome que não descreve o que o
  caso afirma) é permitido desde que o corpo e as asserções fiquem intocados e a task o reporte.
  Alterar asserções, afrouxar uma verificação ou remover um caso é proibido. Duas exceções que
  mexem em asserções, ambas listadas em "Protected Tests" abaixo e ambas com aprovação já concedida
  pelo usuário: `skeletons.test.tsx` (contagem de barras) e `page.test.tsx` (assinatura da action).
- **Toda a escrita em pt-BR.** Nomes de código, comentários e strings de UI.
- **Toda constante compartilhada tem uma fonte só.** `FUSO` vem de `@/lib/fuso`; `primeiroValor` de `@/lib/primeiro-valor`; `BuscarParametro` de `@/app/(dashboard)/dashboard/items/estado-da-tabela`. Não re-declarar nenhuma das três.
- **Fuso do produto é `America/Sao_Paulo`.** Qualquer data que o *usuário* lê (prazo, data) passa por `FUSO`.
- **`ItemListFilter` não ordena por `bids`.** A ordenação da vitrine é em JS (spec § 5.2).
- **Nenhum N+1.** Uma query de lote para os lances, nunca uma query por card.
- **Toda decisão de simplificação deliberada leva um comentário `ponytail:`** nomeando o teto e o upgrade path.
- **Portas do domínio são interfaces separadas e estreitas**, seguindo o precedente de `ItemLister` (`src/domain/repositories/item-repository.ts:188-200`) — nunca um método a mais em `ItemRepository`/`BidRepository`, porque existem 11 fakes de teste implementando essas interfaces.
- **Rodar ao fim de CADA task:** `pnpm test` e `pnpm typecheck`. Ambos precisam passar antes do commit da task.

### Protected Tests (as duas únicas exceções, com aprovação do usuário)

| Arquivo | O que muda | Por que é inevitável |
|---|---|---|
| `src/components/skeletons.test.tsx:35,40` | 3 barras → 4 barras por card | `CARTAS_DO_ESQUELETO * 3` codifica a **forma do `PublicItemCard`**. O esqueleto existe para espelhar o card; mudar o card muda a forma. A asserção não está sendo dobrada — ela é a especificação do espelhamento. |
| `src/app/(public)/[slug]/page.test.tsx:26-29,158,164,178` | mock da action + `toHaveBeenCalledWith("u1")` → `("u1", vista)` | A action passa a receber a `VistaDaVitrine`. A linha 178 afirma a assinatura da chamada. Os **3 casos e suas intenções** (1º flush = esqueleto; vazio = estado vazio; 404 sem listar) permanecem idênticos. |

---

## File Structure

### Criados
| Arquivo | Responsabilidade |
|---|---|
| `src/app/(public)/[slug]/estado-da-vitrine.ts` | Contrato de URL da vitrine: ler e escrever a vista (2 params) |
| `src/app/(public)/[slug]/estado-da-vitrine.test.ts` | Testes do contrato de URL |
| `src/app/(public)/[slug]/controles-da-vitrine.tsx` | Busca (`<form method="get">`) + links de ordenação |
| `src/app/(public)/[slug]/vitrine-hero.tsx` | Header de confiança (avatar, contagem, membro desde) |
| `src/application/use-cases/list-vitrine.ts` | Cruza itens + estatísticas de lance, ordena, projeta no DTO |
| `src/application/use-cases/list-vitrine.test.ts` | Testes do use case (unit puro, sem DOM) |
| `src/application/use-cases/get-vitrine-seller.ts` | Use case do perfil público do vendedor |
| `src/application/use-cases/get-vitrine-seller.test.ts` | Testes do use case do vendedor |
| `src/components/public-item-card.dom.test.tsx` | Testes de DOM do card |

### Modificados
| Arquivo | Mudança |
|---|---|
| `src/components/bid-countdown.tsx` | `formatAbsolute` passa a usar `FUSO` (bug: um dia e 3h errado) |
| `src/components/bid-countdown.test.tsx` | Novo caso afirmando a correção |
| `src/components/public-item-card.tsx` | **Reescrito**: DTO, lance atual, contagem, badge de urgência |
| `src/components/skeletons.tsx` | `CartaoEsqueleto` ganha a 4ª barra (espelha o card novo) |
| `src/components/skeletons.test.tsx` | 3 → 4 barras |
| `src/domain/repositories/bid-repository.ts` | `+ EstatisticasDeLances` (interface separada) |
| `src/domain/repositories/item-repository.ts` | `+ ItemDaVitrine` (DTO, ao lado de `Item`) |
| `src/domain/repositories/user-repository.ts` | `+ VitrineDeVendedor` e `findVitrineBySlug` (interface separada) |
| `src/infrastructure/database/repositories/drizzle-bid-repository.ts` | `+ drizzleEstatisticasDeLances` |
| `src/infrastructure/database/repositories/drizzle-bid-repository.test.ts` | Novo caso de `deVariosItens` |
| `src/infrastructure/database/repositories/drizzle-user-repository.ts` | `+ findVitrineBySlug` (1 query, subquery escalar) |
| `src/presentation/actions/public-actions.ts` | `listVitrineItemsAction(sellerId, vista)`; `+ getVitrineSellerAction` retorna o perfil |
| `src/app/(public)/[slug]/page.tsx` | Hero no shell; controles; `ItensDaVitrine` vira `ListaDaVitrine` |
| `src/app/(public)/[slug]/page.test.tsx` | Mock + assinatura da action |

### Não tocados (e por quê)
- `src/application/use-cases/list-active-items-by-seller.ts` — `public-actions.test.ts` fixa o contrato dele.
- `src/application/use-cases/get-seller-by-slug.ts` — `get-seller-by-slug.test.ts:32` faz `toEqual(sellerRow)`; mudar o retorno quebra o teste. O perfil do hero vem de uma porta nova.
- `src/domain/repositories/analise-repository.ts` — já tem o `maisDisputados` por `JOIN`; a vitrine **não** o reutiliza (filtra por `sellerId`, que o analytics não faz).

---

## Task 0: Consertar a contabilidade das migrações

**Why first:** `items_seller_id_idx` e `payments_mp_payment_id_unique` **existem** no banco, mas `drizzle.__drizzle_migrations` tem só 3 linhas. `pnpm db:migrate` falha com `42P07 relation "payments_mp_payment_id_unique" already exists`. Isso quebra a verificação de **todas** as tasks seguintes, porque a nova query em lote precisa de um banco em estado coerente.

**Files:**
- Modify: banco de dados (tabela `drizzle.__drizzle_migrations`)

**Interfaces:**
- Consumes: nada
- Produces: `pnpm db:migrate` vira no-op; `items_seller_id_idx` disponível para o hero.

- [ ] **Step 1: Confirmar o estado quebrado**

```bash
node -e "
const {Client}=require('pg');const fs=require('fs');
const url=fs.readFileSync('.env','utf8').match(/^DATABASE_URL=(.*)\$/m)[1];
(async()=>{const c=new Client({connectionString:url});await c.connect();
const m=await c.query('select count(*)::int n from drizzle.__drizzle_migrations');
const i=await c.query(\"select indexname from pg_indexes where indexname='items_seller_id_idx'\");
console.log('registradas:',m.rows[0].n,'(esperado 3) | indice existe:',i.rows.length===1);
await c.end();})();"
```

Expected: `registradas: 3 (esperado 3) | indice existe: true`

- [ ] **Step 2: Calcular os hashes e os `when` do journal**

O migrator do drizzle decide **só** por timestamp — `drizzle-orm/pg-core/dialect.cjs:64` compara `Number(lastDbMigration.created_at) < migration.folderMillis`, nunca o hash. Então registrar as duas linhas com o `when` do journal é exatamente o que o drizzle espera.

```bash
node -e "
const fs=require('fs'),crypto=require('crypto');
const j=JSON.parse(fs.readFileSync('drizzle/meta/_journal.json','utf8'));
for(const e of j.entries.filter(e=>['0003_payments_mp_payment_id_unique','0004_warm_smasher'].includes(e.tag))){
  const sql=fs.readFileSync('drizzle/'+e.tag+'.sql','utf8');
  console.log(e.tag, e.when, crypto.createHash('sha256').update(sql).digest('hex'));
}"
```

Expected: duas linhas com `when` = `1789953450297` (0003) e `1790707613827` (0004).

- [ ] **Step 3: Registrar as duas migrações já aplicadas**

```bash
node -e "
const {Client}=require('pg');const fs=require('fs'),crypto=require('crypto');
const url=fs.readFileSync('.env','utf8').match(/^DATABASE_URL=(.*)\$/m)[1];
const j=JSON.parse(fs.readFileSync('drizzle/meta/_journal.json','utf8'));
(async()=>{const c=new Client({connectionString:url});await c.connect();
for(const e of j.entries.filter(e=>['0003_payments_mp_payment_id_unique','0004_warm_smasher'].includes(e.tag))){
  const sql=fs.readFileSync('drizzle/'+e.tag+'.sql','utf8');
  const hash=crypto.createHash('sha256').update(sql).digest('hex');
  await c.query('insert into drizzle.__drizzle_migrations (hash, created_at) values(\$1,\$2) on conflict do nothing',[hash,e.when]);
  console.log('registrada',e.tag);
}
await c.end();})();"
```

- [ ] **Step 4: Verificar que `db:migrate` virou no-op**

```bash
pnpm db:migrate
```

Expected: aplica nada e sai com código 0. Se ainda imprimir `applying migrations...` e falhar, o `when` está errado — repita o Step 2 conferindo os números.

- [ ] **Step 5: Verificar o índice que a vitrine vai usar**

```bash
node -e "
const {Client}=require('pg');const fs=require('fs');
const url=fs.readFileSync('.env','utf8').match(/^DATABASE_URL=(.*)\$/m)[1];
(async()=>{const c=new Client({connectionString:url});await c.connect();
const ids=['ce009dc3-7c77-4033-9339-02f0adbeaabb','dc78548b-8252-4ae0-b0cd-d4840bada13a'];
const q='explain select item_id, count(*)::int, max(amount) from bids where item_id = any(\$1::uuid[]) group by item_id';
console.log('padrao: ', (await c.query(q,[ids])).rows.map(r=>r['QUERY PLAN']).join(' | '));
await c.query('set enable_seqscan = off');
console.log('forcado:', (await c.query(q,[ids])).rows.map(r=>r['QUERY PLAN']).join(' | '));
await c.end();})();"
```

Expected na segunda linha: `Index Only Scan using bids_item_id_amount_idx` com
`Index Cond: (item_id = ANY(...))`.

**CUIDADO com a primeira linha:** com a base de desenvolvimento `bids` tem **9 linhas**, e para 9 linhas o
planner escolhe `Seq Scan` — que e o plano OTIMO e nao um defeito. Por isso o gate usa
`enable_seqscan = off`, que prova que o indice e utilizavel **sem inserir dado** e sem depender do volume
da tabela. Se a primeira linha mostrar `Seq Scan` e a segunda mostrar `Index Only Scan`, o indice esta
correto e a Task 3 pode seguir.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore(db): registra as migracoes 0003 e 0004 que ja estavam aplicadas"
```

---

## Task 1: Corrigir o fuso do prazo no `BidCountdown`

**Why:** Bug real. `formatAbsolute` usa `getUTCDate()`, e o fuso do produto é `America/Sao_Paulo`. Um deadline `2026-10-01T02:59:00Z` é lido "1/10/2026 2:59" quando o real é "30/09/2026 23:59" — errado em um dia e três horas. O countdown numérico conta certo (aritmética de `Date`), então o bug é invisível olhando o número, e na vitrine o `sr-only` é a **única** informação de prazo que o leitor de tela recebe antes de abrir o item.

**Files:**
- Modify: `src/components/bid-countdown.tsx:11-15`
- Modify: `src/components/bid-countdown.test.tsx`

**Interfaces:**
- Consumes: `FUSO` de `@/lib/fuso`
- Produces: `BidCountdown({ deadline }: { deadline: Date })` — assinatura **inalterada**.

- [ ] **Step 1: Ler o teste existente para saber o padrão**

```bash
cat src/components/bid-countdown.test.tsx
```

- [ ] **Step 2: Escrever o teste que falha**

Adicionar ao `describe` existente:

```tsx
  // O prazo que o LEITOR DE TELA ouve, em FUSO do produto. Antes desta correção
  // o `sr-only` formatava com `getUTCDate()`, e um deadline de 30/09 23:59 (fuso
  // de Sao Paulo) aparecia como "1/10 2:59" — um dia e tres horas errado. O
  // countdown numerico contava certo, entao o bug era invisivel olhando o numero.
  it("anuncia o prazo absoluto no fuso do produto, nao em UTC", () => {
    // 2026-10-01T02:59:00Z == 30/09/2026 23:59 em America/Sao_Paulo (UTC-3).
    const html = renderToString(<BidCountdown deadline={new Date("2026-10-01T02:59:00Z")} />);
    expect(html).toContain("30/09/2026 23:59");
    expect(html).not.toContain("1/10/2026 2:59");
  });
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
pnpm vitest run src/components/bid-countdown.test.tsx
```

Expected: FAIL — `expected ... to contain "30/09/2026 23:59"`.

- [ ] **Step 4: A correção**

Em `src/components/bid-countdown.tsx`, **apagar** `formatAbsolute` e o import não usado, e trocar o `<span className="sr-only">`:

```tsx
import { FUSO } from "@/lib/fuso";

// ponytail: o prazo que o leitor de tela ouve e formatado com `FUSO`, e nao com
// `getUTC*`. As duas formas mostram o mesmo instante com textos diferentes, e o
// produto tem fuso fixo (ver `@/lib/fuso`) — o vendedor digita "30/09 23:59" no
// formulario e a tela precisa devolver "30/09 23:59". A versao com `getUTC*`
// devolvia "1/10 2:59": um dia e tres horas de erro, invisivel porque o
// countdown numerico (aritmetica de `Date`) contava certo. O upgrade path, se o
// produto atender gente fora do Brasil, e um `APP_TIMEZONE` no `.env` lido em
// `@/lib/fuso` — este arquivo continua lendo a constante e nao muda.
function formatAbsolute(d: Date): string {
  return d.toLocaleString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

Expected output: `30/09/2026, 23:59` — com **vírgula** antes das horas no `pt-BR`. Ajustar a asserção do Step 2 para o formato real que o `toLocaleString` produzir, e o comentário junto:

```tsx
    expect(html).toContain("30/09/2026");
    expect(html).toContain("23:59");
    expect(html).not.toContain("1/10/2026");
```

- [ ] **Step 5: Rodar e ver passar**

```bash
pnpm vitest run src/components/bid-countdown.test.tsx
```

Expected: PASS, todos os casos.

- [ ] **Step 6: Verificação completa e commit**

```bash
pnpm test && pnpm typecheck
git add src/components/bid-countdown.tsx src/components/bid-countdown.test.tsx
git commit -m "fix(bid-countdown): anuncia o prazo no fuso do produto, nao em UTC"
```

---

## Task 2: Contrato de URL da vitrine

**Why:** A vitrine precisa de `q` e `ordenar` na URL, com o mesmo padrão do `dashboard/items`: o visitante pode voltar, compartilhar e refazer (IHC *user control*). Este módulo é o **único** lugar que sabe ler e escrever esses dois parâmetros.

**Files:**
- Create: `src/app/(public)/[slug]/estado-da-vitrine.ts`
- Test: `src/app/(public)/[slug]/estado-da-vitrine.test.ts`

**Interfaces:**
- Consumes: `BuscarParametro` de `@/app/(dashboard)/dashboard/items/estado-da-tabela`
- Produces:
  ```ts
  export type OrdenacaoDaVitrine = "prazo" | "lance" | "recentes";
  export interface VistaDaVitrine { q: string; ordenar: OrdenacaoDaVitrine }
  export const VISTA_PADRAO_DA_VITRINE: VistaDaVitrine;
  export function interpretarVitrine(buscar: BuscarParametro): VistaDaVitrine;
  export function hrefDaVista(slug: string, vista: VistaDaVitrine): string;
  ```

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/app/(public)/[slug]/estado-da-vitrine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  VISTA_PADRAO_DA_VITRINE,
  hrefDaVista,
  interpretarVitrine,
  type OrdenacaoDaVitrine,
} from "./estado-da-vitrine";

// ponytail: o `escrever` monta a `URLSearchParams` e devolve um `buscar` que le
// dela. E o par inverso do `interpretarVitrine` (que recebe o `buscar` do Next),
// e e por isso que o round-trip do fim do arquivo fecha sem adaptador: a funcao que
// escreve a URL e a mesma que a le, entao `ler(emitir(v)) === emitir(v)` para
// toda vista.
function escrever(url: string): (nome: string) => string | null {
  const p = new URL(url, "https://ex.com").searchParams;
  return (nome) => p.get(nome);
}

describe("interpretarVitrine", () => {
  it("sem parametros devolve a vista padrao: sem busca, terminating primeiro", () => {
    expect(interpretarVitrine(escrever("/ana"))).toEqual(VISTA_PADRAO_DA_VITRINE);
    expect(VISTA_PADRAO_DA_VITRINE).toEqual({ q: "", ordenar: "prazo" });
  });

  it("le a busca e apara as pontas", () => {
    expect(interpretarVitrine(escrever("/ana?q=%20%20console%20%20")).q).toBe("console");
  });

  it("le as tres ordenacoes", () => {
    for (const ordenar of ["prazo", "lance", "recentes"] as const satisfies OrdenacaoDaVitrine[]) {
      expect(interpretarVitrine(escrever(`/ana?ordenar=${ordenar}`)).ordenar).toBe(ordenar);
    }
  });

  it("ordenar invalido cai no padrao, e nao em erro nem em indefinido", () => {
    expect(interpretarVitrine(escrever("/ana?ordenar=%3Bdrop")).ordenar).toBe("prazo");
    expect(interpretarVitrine(escrever("/ana?ordenar=")).ordenar).toBe("prazo");
    expect(interpretarVitrine(escrever("/ana?ordenar=preco")).ordenar).toBe("prazo");
  });
});

describe("hrefDaVista", () => {
  it("a vista padrao e o caminho puro, sem query", () => {
    expect(hrefDaVista("ana", VISTA_PADRAO_DA_VITRINE)).toBe("/ana");
  });

  it("escreve o slug no caminho e a query depois", () => {
    expect(hrefDaVista("ana-impala", { q: "console", ordenar: "lance" })).toBe(
      "/ana-impala?q=console&ordenar=lance",
    );
  });

  it("nao escreve o que ja e o padrao", () => {
    expect(hrefDaVista("ana", { q: "", ordenar: "prazo" })).toBe("/ana");
  });

  it("escreve apenas a ordenacao quando nao ha busca", () => {
    expect(hrefDaVista("ana", { q: "", ordenar: "recentes" })).toBe("/ana?ordenar=recentes");
  });

  it("codifica a busca: espaco vira %20 e nao +, e & nao injeta parametro", () => {
    const href = hrefDaVista("ana", { q: "a b&c=d", ordenar: "prazo" });
    expect(href).toBe("/ana?q=a%20b%26c%3Dd");
    expect(new URLSearchParams(href.split("?")[1]).get("q")).toBe("a b&c=d");
  });
});

// ponytail: o round-trip e o que trava a invariante que o `estado-da-tabela.ts`
// tambem trava: duas vistas iguais produzem a MESMA string, que e o que faz
// "copiar e colar o link" funcionar e o botao "voltar" desfazer a coisa certa.
describe("round-trip: ler o que foi escrito devolve a mesma vista", () => {
  const vistas = [
    { q: "", ordenar: "prazo" },
    { q: "console", ordenar: "prazo" },
    { q: "", ordenar: "lance" },
    { q: "", ordenar: "recentes" },
    { q: "jogo raro", ordenar: "recentes" },
    { q: "a&b c", ordenar: "lance" },
  ] as const;

  for (const vista of vistas) {
    it(`${JSON.stringify(vista)} sobrevive a emitir e ler`, () => {
      const href = hrefDaVista("ana", vista);
      expect(interpretarVitrine(escrever(href))).toEqual(vista);
      expect(hrefDaVista("ana", interpretarVitrine(escrever(href)))).toBe(href);
    });
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm vitest run "src/app/(public)/[slug]/estado-da-vitrine.test.ts"
```

Expected: FAIL — `Cannot find module './estado-da-vitrine'`.

- [ ] **Step 3: A implementação**

Criar `src/app/(public)/[slug]/estado-da-vitrine.ts`:

```ts
import type { BuscarParametro } from "@/app/(dashboard)/dashboard/items/estado-da-tabela";

// ponytail: este arquivo e o CONTRATO DE URL da vitrine, e ele espelha
// `estado-da-tabela.ts` com tres parametros em vez de sete. A duplicacao e
// deliberada: os dois nao tem nada em comum alem do padrao (ler a URL num
// `Vista`, escrever de volta), e um modulo unico com dois formatos de vista
// seria um tipo `Vista` com seis campos opcionais e nenhuma combinacao valida.
// `BuscarParametro` e IMPORTADO, e nao re-declarado — duas definicoes do mesmo
// contrato e o mesmo defeito que `FUSO` e `primeiroValor` resolveram.
//
// ponytail: `ordenar` e `lance` e nao `preco` porque o que a vitrine ordena e o
// lance ATUAL (`max(bids.amount)`), nao o lance inicial (`items.min_initial_bid`,
// que e o "preço" deste produto). `?ordenar=preco` seria o nome do campo errado
// na URL, e a URL e o contrato publico desta tela.
export type OrdenacaoDaVitrine = "prazo" | "lance" | "recentes";

export interface VistaDaVitrine {
  q: string;
  ordenar: OrdenacaoDaVitrine;
}

// ponytail: o padrao e "Termina em breve", e nao "Mais recentes". A vitrine e a
// rota onde o visitante esta com dinheiro na mao e o item na tela: o que decide a
// conversao nao e o que foi publicado por ultimo, e o que esta acabando. O
// badge de urgencia do card (spec § 3.1) e o lado visual da mesma decisao.
export const VISTA_PADRAO_DA_VITRINE: VistaDaVitrine = { q: "", ordenar: "prazo" };

const ORDENACOES = new Set<string>(["prazo", "lance", "recentes"]);

function ehOrdenacao(bruto: string): bruto is OrdenacaoDaVitrine {
  return ORDENACOES.has(bruto);
}

// ponytail: `q` e aparado na LEITURA pelo mesmo motivo do `estado-da-tabela`: a
// caixa de busca e controlada pelo `q` da URL, entao um espaco nas pontas que
// sobrevivesse apareceria nela depois de um back/forward — e o que o usuario ve
// precisa ser o que o servidor filtrou. Aparar nas duas pontes torna o
// `hrefDaVista` ponto fixo: ler(emitir(v)) === emitir(v) para toda vista.
export function interpretarVitrine(buscar: BuscarParametro): VistaDaVitrine {
  const ordenar = buscar("ordenar");
  return {
    q: (buscar("q") ?? "").trim(),
    ordenar: ordenar !== null && ehOrdenacao(ordenar) ? ordenar : VISTA_PADRAO_DA_VITRINE.ordenar,
  };
}

// ponytail: o `slug` entra como PARAMETRO e nao como constante com placeholder.
// O caminho e "/" + slug, e um `"/{slug}"` entre as aspas seria uma string que
// esta funcao teria de substituir — uma regex no fim das contas, para um
// caminho que e concatenacao.
//
// ponytail: `URLSearchParams` nao serve aqui porque escreve espaco como `+`, e
// `+` em query string e lido como espaco por um decodificador e como "mais" por
// outro. `encodeURIComponent` escreve `%20`, que todo mundo le como espaco.
export function hrefDaVista(slug: string, vista: VistaDaVitrine): string {
  const partes: string[] = [];
  const termo = vista.q.trim();
  if (termo !== "") partes.push(`q=${encodeURIComponent(termo)}`);
  if (vista.ordenar !== VISTA_PADRAO_DA_VITRINE.ordenar) partes.push(`ordenar=${vista.ordenar}`);
  return partes.length === 0 ? `/${slug}` : `/${slug}?${partes.join("&")}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
pnpm vitest run "src/app/(public)/[slug]/estado-da-vitrine.test.ts"
```

Expected: PASS — 15 casos.

- [ ] **Step 5: Verificação completa e commit**

```bash
pnpm test && pnpm typecheck
git add "src/app/(public)/[slug]/estado-da-vitrine.ts" "src/app/(public)/[slug]/estado-da-vitrine.test.ts"
git commit -m "feat(vitrine): contrato de URL da vitrine (busca e ordenacao)"
```

---

## Task 3: Estatísticas de lance em lote

**Why:** O card precisa de `totalDeLances` e `maiorLance`. `countBids(itemId)` já existe mas é **por item** — usá-lo por card é N+1 na rota pública mais rastreada do produto. Uma query agrupada resolve.

**Files:**
- Modify: `src/domain/repositories/bid-repository.ts`
- Modify: `src/infrastructure/database/repositories/drizzle-bid-repository.ts`
- Modify: `src/infrastructure/database/repositories/drizzle-bid-repository.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores
- Produces:
  ```ts
  // em src/domain/repositories/bid-repository.ts
  export interface EstatisticasDeLance { total: number; maior: number | null }
  export interface EstatisticasDeLances {
    deVariosItens(itemIds: string[]): Promise<Map<string, EstatisticasDeLance>>;
  }
  // em src/infrastructure/database/repositories/drizzle-bid-repository.ts
  export const drizzleEstatisticasDeLances: EstatisticasDeLances;
  export function paraEstatisticas(
    linhas: { itemId: string; total: number; maior: number | null }[],
  ): Map<string, EstatisticasDeLance>;
  ```

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao `drizzle-bid-repository.test.ts` existente:

```ts
import { paraEstatisticas } from "./drizzle-bid-repository";

// ponytail: `paraEstatisticas` e a funcao pura que o teste alcanca, e ela existe
// por um motivo concreto: `deVariosItens` faz I/O, e um teste de I/O aqui
// precisaria de banco. A transformacao "linhas do GROUP BY -> Map" e a parte que
// tem regra (a ABSENCAO no mapa e o `maiorLance === null`, e nao uma linha com
// zero), entao e ela que o teste trava.
describe("paraEstatisticas", () => {
  it("agrupa as linhas por item", () => {
    const mapa = paraEstatisticas([
      { itemId: "i1", total: 3, maior: 28080 },
      { itemId: "i2", total: 1, maior: 10000 },
    ]);
    expect(mapa.get("i1")).toEqual({ total: 3, maior: 28080 });
    expect(mapa.get("i2")).toEqual({ total: 1, maior: 10000 });
  });

  it("item sem lance NAO entra no mapa — a ausencia e o maior === null", () => {
    const mapa = paraEstatisticas([{ itemId: "i1", total: 1, maior: 500 }]);
    expect(mapa.has("i2")).toBe(false);
  });

  it("lista vazia devolve mapa vazio", () => {
    expect(paraEstatisticas([]).size).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm vitest run src/infrastructure/database/repositories/drizzle-bid-repository.test.ts
```

Expected: FAIL — `paraEstatisticas` não é exportada.

- [ ] **Step 3: A porta no domínio**

Em `src/domain/repositories/bid-repository.ts`, **adicionar ao fim**:

```ts
// ponytail: o agregado que a vitrine precisa, e NAO mais um metodo em
// `BidRepository`. `BidRepository` tem metodos que GRAVAM (`placeBid`,
// `cancelBidByItem`); a vitrine so le um agregado. A porta separada deixa isso
// explicito e — o que importa no curto prazo — os fakes de `BidRepository` nos
// testes de `placeBid` nao recebem um metodo a implementar. E o mesmo motivo do
// `ItemLister` em `item-repository.ts:188-200`.
export interface EstatisticasDeLance {
  total: number;
  maior: number | null;
}

export interface EstatisticasDeLances {
  // ponytail: `ids` vazio devolve `Map` vazio SEM tocar no banco. A vitrine sem
  // itens nao deve abrir uma consulta so para receber zero linhas.
  deVariosItens(itemIds: string[]): Promise<Map<string, EstatisticasDeLance>>;
}
```

- [ ] **Step 4: A implementação**

Em `src/infrastructure/database/repositories/drizzle-bid-repository.ts`, trocar o import da linha 1 e adicionar no fim:

```ts
import { and, count, desc, eq, inArray, max, sql } from "drizzle-orm";
import type { EstatisticasDeLance, EstatisticasDeLances } from "@/domain/repositories/bid-repository";
```

```ts
// ponytail: `count(*)` volta `bigint` do Postgres e o `pg` entrega como TEXTO, e
// `max(amount)` volta `integer`. Por isso o `::int` e o `Number` no `paraEstatisticas`:
// sem eles, `total` seria a string "3" e `maiorLance > 100` compararia string com
// numero — que em JS significa `NaN` silencioso virando posicao de ordenacao.
export function paraEstatisticas(
  linhas: { itemId: string; total: number; maior: number | null }[],
): Map<string, EstatisticasDeLance> {
  const mapa = new Map<string, EstatisticasDeLance>();
  for (const linha of linhas) {
    mapa.set(linha.itemId, { total: Number(linha.total), maior: linha.maior === null ? null : Number(linha.maior) });
  }
  return mapa;
}

// ponytail: uma query, e nao uma por item. O indice `(item_id, amount DESC)`
// (migracao 0004) faz isto ser INDEX-ONLY: o `GROUP BY item_id` e o `max(amount)`
// leem as duas colunas do indice, sem tocar no heap. Verificar com `explain` e o
// que prova que a query nao degradou. Num banco de 9 linhas o planner escolhe seq scan
// (e esta certo); o indice e usado quando `bids` cresce — ver Task 0 Step 5, que prova
// a usabilidade dele com `enable_seqscan = off`.
// tabela de lances inteira, e `inArray` com a lista toda e o que mantem o plano
// como index scan.
export const drizzleEstatisticasDeLances: EstatisticasDeLances = {
  async deVariosItens(itemIds) {
    if (itemIds.length === 0) return new Map();
    const linhas = await db
      .select({
        itemId: bids.itemId,
        total: sql<number>`count(*)::int`,
        maior: max(bids.amount),
      })
      .from(bids)
      .where(inArray(bids.itemId, itemIds))
      .groupBy(bids.itemId);
    return paraEstatisticas(linhas);
  },
};
```

- [ ] **Step 5: Rodar e ver passar**

```bash
pnpm vitest run src/infrastructure/database/repositories/drizzle-bid-repository.test.ts
```

Expected: PASS — 5 casos (2 antigos + 3 novos).

- [ ] **Step 6: Provar a query no banco real**

```bash
node -e "
const {Client}=require('pg');const fs=require('fs');
const url=fs.readFileSync('.env','utf8').match(/^DATABASE_URL=(.*)\$/m)[1];
(async()=>{const c=new Client({connectionString:url});await c.connect();
const e=await c.query(\"explain select item_id, count(*)::int, max(amount) from bids where item_id in (select id from items) group by item_id\");
console.log(e.rows.map(r=>r['QUERY PLAN']).join(' | '));
const r=await c.query(\"select item_id, count(*)::int as total, max(amount) as maior from bids group by item_id\");
console.log(JSON.stringify(r.rows));await c.end();})();"
```

Expected: plano com `Index Scan`/`Index Only Scan` em `bids`, e as linhas com `total` e `maior` **números** (não strings).

- [ ] **Step 7: Verificação completa e commit**

```bash
pnpm test && pnpm typecheck
git add src/domain/repositories/bid-repository.ts src/infrastructure/database/repositories/drizzle-bid-repository.ts src/infrastructure/database/repositories/drizzle-bid-repository.test.ts
git commit -m "feat(lances): consulta em lote de total e maior lance por item"
```

---

## Task 4: `list-vitrine` — o use case que ordena

**Why:** É aqui que a decisão "o maior lance fica sempre na primeira posição" vira código. `ItemListFilter` não ordena por `bids`, e a vitrine não pagina — então ela já carrega o conjunto inteiro e o `maiorLance` já é buscado para o card. Ordenar por um array que já está na mão é `Array.prototype.sort`.

**Files:**
- Modify: `src/domain/repositories/item-repository.ts` (`+ ItemDaVitrine`)
- Create: `src/application/use-cases/list-vitrine.ts`
- Test: `src/application/use-cases/list-vitrine.test.ts`

**Interfaces:**
- Consumes: `ItemRepository` de `@/domain/repositories/item-repository`; `EstatisticasDeLances` de `@/domain/repositories/bid-repository`; `VistaDaVitrine` de `@/app/(public)/[slug]/estado-da-vitrine`
- Produces:
  ```ts
  // em src/domain/repositories/item-repository.ts
  export interface ItemDaVitrine {
    id: string; title: string; type: ItemType; minInitialBid: number;
    bidDeadline: Date; imageUrl: string | null;
    totalDeLances: number; maiorLance: number | null;
  }
  // em src/application/use-cases/list-vitrine.ts
  export async function listVitrine(
    itemRepo: Pick<ItemRepository, "findBySellerId">,
    lancesRepo: EstatisticasDeLances,
    sellerId: string,
    vista: VistaDaVitrine,
  ): Promise<ItemDaVitrine[]>;
  export function ordenarParaVitrine(
    itens: ItemDaVitrine[],
    ordenar: OrdenacaoDaVitrine,
  ): ItemDaVitrine[];
  ```

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/application/use-cases/list-vitrine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { listVitrine, ordenarParaVitrine } from "./list-vitrine";
import type { Item, ItemDaVitrine } from "@/domain/repositories/item-repository";
import type { EstatisticasDeLance, EstatisticasDeLances } from "@/domain/repositories/bid-repository";
import type { VistaDaVitrine } from "@/app/(public)/[slug]/estado-da-vitrine";

const VISTA: VistaDaVitrine = { q: "", ordenar: "prazo" };

function item(id: string, over: Partial<Item> = {}): Item {
  return {
    id, sellerId: "u1", title: `Item ${id}`, description: "texto longo",
    type: "product", imageUrl: null, minInitialBid: 1000, minBidIncrement: 100,
    bidDeadline: new Date("2026-10-10T12:00:00Z"), paymentDeadlineDays: 3,
    status: "active", createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"), ...over,
  };
}

function vitrineItem(id: string, maior: number | null, over: Partial<ItemDaVitrine> = {}): ItemDaVitrine {
  return {
    id, title: `Item ${id}`, type: "product", minInitialBid: 1000,
    bidDeadline: new Date("2026-10-10T12:00:00Z"), imageUrl: null,
    totalDeLances: maior === null ? 0 : 1, maiorLance: maior, ...over,
  };
}

const SEM_LANCE = new Map<string, EstatisticasDeLance>();

function comLances(entradas: [string, number, number][]): EstatisticasDeLances {
  const mapa = new Map(entradas.map(([id, total, maior]) => [id, { total, maior }]));
  return { async deVariosItens() { return mapa; } };
}

describe("ordenarParaVitrine", () => {
  it("por prazo: o que encerra primeiro vem primeiro", () => {
    const a = vitrineItem("a", 10, { bidDeadline: new Date("2026-10-01T12:00:00Z") });
    const b = vitrineItem("b", 99, { bidDeadline: new Date("2026-11-01T12:00:00Z") });
    expect(ordenarParaVitrine([b, a], "prazo").map((i) => i.id)).toEqual(["a", "b"]);
  });

  // ponytail: ESTE e o `it` que trava a decisao do usuario — "o maior lance deve
  // ter sempre a primeira posicao". O `b` tem o maior valor (99) e a `a` nao
  // (10), e a ordem observada e [b, a].
  it("por lance: o MAIOR lance real vem primeiro, nao o lance inicial", () => {
    const a = vitrineItem("a", 10, { minInitialBid: 999999 });
    const b = vitrineItem("b", 99, { minInitialBid: 1 });
    expect(ordenarParaVitrine([a, b], "lance").map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("por lance: item SEM lance vai para o FIM, nunca para o topo", () => {
    const semLances = vitrineItem("sem", null);
    const comLances = vitrineItem("com", 1);
    expect(ordenarParaVitrine([semLances, comLances], "lance").map((i) => i.id)).toEqual(["com", "sem"]);
    expect(ordenarParaVitrine([comLances, semLances], "lance").map((i) => i.id)).toEqual(["com", "sem"]);
  });

  it("por lance: empate desempata pelo prazo, que e a ordem do resto da tela", () => {
    const tarde = vitrineItem("tarde", 50, { bidDeadline: new Date("2026-12-01T12:00:00Z") });
    const cedo = vitrineItem("cedo", 50, { bidDeadline: new Date("2026-10-01T12:00:00Z") });
    expect(ordenarParaVitrine([tarde, cedo], "lance").map((i) => i.id)).toEqual(["cedo", "tarde"]);
  });

  it("por recentes: o mais novo primeiro", () => {
    const velho = vitrineItem("velho", 1, { title: "x" });
    const novos = vitrineItem("novo", 1);
    // createdAt nao esta no DTO; o desempate de "recentes" usa o id como
    // substituto estavel — ver a nota do comparador na implementacao.
    expect(ordenarParaVitrine([novos, velho], "recentes").map((i) => i.id)).toEqual(["novo", "velho"]);
  });

  it("a lista original nao e mutada (o .sort() do array recebido seria um bug)", () => {
    const original = [vitrineItem("a", 1), vitrineItem("b", 5)];
    const copia = [...original];
    ordenarParaVitrine(original, "lance");
    expect(original).toEqual(copia);
  });
});

describe("listVitrine", () => {
  it("busca so os itens ATIVOS, sempre", async () => {
    const filtros: unknown[] = [];
    const itemRepo = { async findBySellerId(_: string, f?: unknown) { filtros.push(f); return []; } };
    await listVitrine(itemRepo as never, { async deVariosItens() { return SEM_LANCE; } }, "u1", VISTA);
    expect(filtros[0]).toEqual({ status: "active" });
  });

  it("repassa a busca da URL para o filtro do repositorio", async () => {
    const filtros: any[] = [];
    const itemRepo = { async findBySellerId(_: string, f?: any) { filtros.push(f); return []; } };
    await listVitrine(itemRepo as never, { async deVariosItens() { return SEM_LANCE; } }, "u1",
      { q: "console", ordenar: "prazo" });
    expect(filtros[0]).toEqual({ status: "active", q: "console" });
  });

  it("NÃO passa orderBy: a ordenacao e em JS, e nao no SQL", async () => {
    const filtros: any[] = [];
    const itemRepo = { async findBySellerId(_: string, f?: any) { filtros.push(f); return []; } };
    await listVitrine(itemRepo as never, { async deVariosItens() { return SEM_LANCE; } }, "u1",
      { q: "", ordenar: "lance" });
    expect(filtros[0].orderBy).toBeUndefined();
    expect(filtros[0].direction).toBeUndefined();
  });

  it("carrega as estatisticas dos itens numa unica chamada em lote", async () => {
    const pedidos: string[][] = [];
    const lances: EstatisticasDeLances = {
      async deVariosItens(ids) { pedidos.push(ids); return new Map([["i1", { total: 2, maior: 700 }]]); },
    };
    const itemRepo = { async findBySellerId() { return [item("i1"), item("i2")]; } };
    await listVitrine(itemRepo as never, lances, "u1", VISTA);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toEqual(["i1", "i2"]);
  });

  it("projeta no DTO: o maior lance do mapa entra no card", async () => {
    const lances = { async deVariosItens() { return new Map([["i1", { total: 2, maior: 700 }]]); } };
    const itemRepo = { async findBySellerId() { return [item("i1")]; } };
    const [primeiro] = await listVitrine(itemRepo as never, lances, "u1", VISTA);
    expect(primeiro.maiorLance).toBe(700);
    expect(primeiro.totalDeLances).toBe(2);
  });

  it("item ausente do mapa de lances vira maiorLance null e totalDeLances 0", async () => {
    const lances = { async deVariosItens() { return SEM_LANCE; } };
    const itemRepo = { async findBySellerId() { return [item("i1")]; } };
    const [primeiro] = await listVitrine(itemRepo as never, lances, "u1", VISTA);
    expect(primeiro.maiorLance).toBeNull();
    expect(primeiro.totalDeLances).toBe(0);
  });

  it("vitrine vazia nao chama o repositorio de lances", async () => {
    let chamou = false;
    const lances: EstatisticasDeLances = { async deVariosItens() { chamou = true; return SEM_LANCE; } };
    const itemRepo = { async findBySellerId() { return []; } };
    expect(await listVitrine(itemRepo as never, lances, "u1", VISTA)).toEqual([]);
    expect(chamou).toBe(false);
  });

  it("o DTO nao carrega `description`: o texto longo nao atravessa o payload do RSC", async () => {
    const lances = { async deVariosItens() { return SEM_LANCE; } };
    const itemRepo = { async findBySellerId() { return [item("i1", { description: "LONGO" })]; } };
    const [primeiro] = await listVitrine(itemRepo as never, lances, "u1", VISTA);
    expect(Object.keys(primeiro).sort()).toEqual(
      ["bidDeadline", "id", "imageUrl", "maiorLance", "minInitialBid", "title", "totalDeLances", "type"],
    );
    expect(JSON.stringify(primeiro)).not.toContain("LONGO");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm vitest run src/application/use-cases/list-vitrine.test.ts
```

Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: O DTO no domínio**

Em `src/domain/repositories/item-repository.ts`, adicionar ao fim:

```ts
// ponytail: a projecao da vitrine. Fica AQUI, e nao em `src/app/(public)/[slug]/`,
// porque o produtor deste objeto e o use case `listVitrine`, que vive em
// `src/application/` — e um use case importando de `src/app` seria a seta da
// Clean Architecture virada. O `ItemDaTabela` do dashboard mora com o seu
// consumidor porque o consumidor dele e um componente de `src/app`; aqui o
// consumidor primario e o use case.
//
// E uma WHITELIST, e nao `const { ...resto } = item`: o spread e o que faria
// `description` (o texto longo) atravessar o payload do RSC sem ser mostrado, e o
// que faria um campo novo do dominio vazar para a tela sem ninguem perceber. O
// teste que exige exatamente estas oito chaves e o que trava essa porta.
export interface ItemDaVitrine {
  id: string;
  title: string;
  type: ItemType;
  minInitialBid: number;
  bidDeadline: Date;
  imageUrl: string | null;
  totalDeLances: number;
  maiorLance: number | null;
}
```

- [ ] **Step 4: A implementação**

Criar `src/application/use-cases/list-vitrine.ts`:

```ts
import type { Item, ItemDaVitrine, ItemListFilter, ItemRepository } from "@/domain/repositories/item-repository";
import type { EstatisticasDeLance, EstatisticasDeLances } from "@/domain/repositories/bid-repository";
import type { OrdenacaoDaVitrine, VistaDaVitrine } from "@/app/(public)/[slug]/estado-da-vitrine";

// ponytail: SEM LANCE e `-Infinity`, e nao `0`. O `maiorLance` e um valor em
// REAIS, e um item com lance de R$ 0,00 (que `placeBid` impede hoje, mas nao
// impede para sempre) precisa ficar ABAIXO de qualquer lance de verdade. Com `0`
// ele empataria com um lance minimo e o desempate por prazo o poderia puxar para
// o topo de "Maior lance" — a tela desmentindo o proprio rotulo. `-Infinity` faz
// o `null` cair para o fim sem nenhum `if` dentro do comparador.
const SEM_LANCE = Number.NEGATIVE_INFINITY;

function valorDoLance(item: ItemDaVitrine): number {
  return item.maiorLance ?? SEM_LANCE;
}

function comparar(a: ItemDaVitrine, b: ItemDaVitrine, ordenar: OrdenacaoDaVitrine): number {
  switch (ordenar) {
    case "lance": {
      // desc pelo maior lance REAL, e desempate por prazo asc. O desempate
      // importa: dois itens nao podem ter o mesmo maior lance (`placeBid` valida
      // incremento), mas um comparador que depende dessa invariante quebra no
      // dia que ela mudar — e o resultado seria uma ordem que muda entre dois
      // renders do mesmo conjunto.
      const porLance = valorDoLance(b) - valorDoLance(a);
      if (porLance !== 0) return porLance;
      return a.bidDeadline.getTime() - b.bidDeadline.getTime();
    }
    case "recentes":
      // ponytail: "recentes" usa o `id` como desempate, nao `createdAt`, porque o
      // DTO nao carrega `createdAt` (nao aparece em lugar nenhum do card). Como
      // o `id` e um uuid, o desempate e estavel e total, que e o que o
      // comparador precisa ser — mas ele e ARBITRARIO entre itens com o mesmo
      // instante, o que e aceitavel porque o `createdAt` tem precisao de
      // segundos. O upgrade path, se dois itens dependerem dessa ordem, e
      // adicionar `createdAt` ao DTO — mais um campo no payload.
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    case "prazo":
      return a.bidDeadline.getTime() - b.bidDeadline.getTime();
  }
}

// ponytail: `[...itens]` antes do `.sort()`. `Array.prototype.sort` e IN-PLACE, e
// ordenar o array que o repositorio devolveu faria o `findBySellerId` seguinte
// receber um array ja reordenado sem ele saber — o tipo classico de bug que so
// aparece quando dois consumidores aparecem na mesma tela.
export function ordenarParaVitrine(itens: ItemDaVitrine[], ordenar: OrdenacaoDaVitrine): ItemDaVitrine[] {
  return [...itens].sort((a, b) => comparar(a, b, ordenar));
}

// ponytail: a ordenacao e EM JS, e nao no SQL, por um motivo medido. A vitrine nao
// pagina (decisao de escopo), entao ela JA carrega o conjunto inteiro em memoria
// — o `ORDER BY` do banco nao evita nenhuma leitura. E o `maiorLance` e buscado de
// qualquer forma, porque o card precisa dele para mostrar o lance atual. Ordenar
// por um array que ja esta na mao e `Array.prototype.sort`; a alternativa (um
// `ORDER BY (select max(amount) ...)` no repositorio) pagaria uma subquery por
// item para reordenar o que ja esta carregado, E criaria um segundo caminho de SQL
// de lances que pode divergir do primeiro. O bonus: o numero que decide a posicao
// e LITERALMENTE o mesmo que o card exibe, porque nao sao calculados duas vezes.
//
// O `q` CONTINUA no SQL: e substring insensivel a caixa e acento sobre titulo +
// rotulos, e reimplementar isso em JS seria uma segunda implementacao da mesma
// regra. Entao a consulta e meio SQL (filtrar) e meio JS (ordenar) — e a divisao
// segue quem tem o dado: o filtro tem o `CASE` de rotulos, a ordem tem o agregado
// de lances.
//
// TETO: o conjunto inteiro em memoria. Um vendedor com 5.000 itens ativos paga
// 5.000 linhas mais 5.000 chaves de mapa por request, e o `sort` em JS perde o
// indice do banco. UPGRADE PATH: quando esse numero incomodar, mover a ordenacao
// para o repositorio com um `JOIN bids ... GROUP BY items.id` e um
// `orderBy sql`\u0060(max(bids.amount) desc nulls last)\u0060` — o
// `maisDisputados` do `drizzle-analise-repository` ja e o padrao. Nada alem do
// `ordenarParaVitrine` muda quando isso acontecer.
export async function listVitrine(
  itemRepo: Pick<ItemRepository, "findBySellerId">,
  lancesRepo: EstatisticasDeLances,
  sellerId: string,
  vista: VistaDaVitrine,
): Promise<ItemDaVitrine[]> {
  const filtro: ItemListFilter = { status: "active" };
  if (vista.q !== "") filtro.q = vista.q;
  const itens: Item[] = await itemRepo.findBySellerId(sellerId, filtro);
  if (itens.length === 0) return [];

  const ids = itens.map((i) => i.id);
  const estatisticas: Map<string, EstatisticasDeLance> = await lancesRepo.deVariosItens(ids);

  const dtos: ItemDaVitrine[] = itens.map((item) => {
    const stat = estatisticas.get(item.id);
    return {
      id: item.id,
      title: item.title,
      type: item.type,
      minInitialBid: item.minInitialBid,
      bidDeadline: item.bidDeadline,
      imageUrl: item.imageUrl,
      totalDeLances: stat?.total ?? 0,
      maiorLance: stat?.maior ?? null,
    };
  });

  return ordenarParaVitrine(dtos, vista.ordenar);
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
pnpm vitest run src/application/use-cases/list-vitrine.test.ts
```

Expected: PASS — 14 casos.

- [ ] **Step 6: Verificação completa e commit**

```bash
pnpm test && pnpm typecheck
git add src/domain/repositories/item-repository.ts src/application/use-cases/list-vitrine.ts src/application/use-cases/list-vitrine.test.ts
git commit -m "feat(vitrine): use case que cruza lances e ordena (maior lance sempre no topo)"
```

---

## Task 5: O `PublicItemCard` reescrito

**Why:** É o card que responde às duas das três perguntas que o visitante faz nos primeiros 3 segundos (quanto custa agora, quanto tempo tenho) — hoje ele responde a nenhuma. Marketing: o badge de urgência é a inversão Von Restorff (o único elemento colorido da vitrine).

**Files:**
- Modify: `src/components/public-item-card.tsx` (reescrito)
- Create: `src/components/public-item-card.dom.test.tsx`

**Interfaces:**
- Consumes: `ItemDaVitrine` de `@/domain/repositories/item-repository`; `BidCountdown` de `@/components/bid-countdown`; `Badge` de `@/components/ui/badge`; `formatReais` de `@/lib/format-reais`; `ROTULO_TIPO` de `@/domain/repositories/item-repository`
- Produces:
  ```ts
  export function PublicItemCard({ item, slug }: { item: ItemDaVitrine; slug: string }): React.JSX.Element;
  export const JANELA_DE_URGENCIA_EM_HORAS: number; // 24
  ```

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/components/public-item-card.dom.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { ItemDaVitrine } from "@/domain/repositories/item-repository";

const mocks = vi.hoisted(() => ({ BidCountdown: vi.fn(() => null) }));
vi.mock("@/components/bid-countdown", () => ({ BidCountdown: mocks.BidCountdown }));

import { PublicItemCard, JANELA_DE_URGENCIA_EM_HORAS } from "./public-item-card";

function agoraMais(horas: number): Date {
  return new Date(Date.now() + horas * 60 * 60 * 1000);
}

function vitrine(over: Partial<ItemDaVitrine> = {}): ItemDaVitrine {
  return {
    id: "i1", title: "Console retrô", type: "product", minInitialBid: 1000,
    bidDeadline: agoraMais(72), imageUrl: null, totalDeLances: 0, maiorLance: null, ...over,
  };
}

function html(over: Partial<ItemDaVitrine> = {}): string {
  return renderToString(<PublicItemCard item={vitrine(over)} slug="ana" />);
}

// ponytail: o deadline e calculado a partir de `Date.now()` no momento do teste
// e nao fixado numa data, porque o badge de urgencia e uma funcao do TEMPO
// RESTANTE. Fixar a data transformaria o teste num teste de calendarios: ele
// passaria hoje e falharia amanha, e ninguem mexeria no codigo.

describe("PublicItemCard — o lance atual", () => {
  it("sem lance: mostra o lance inicial e NAO mostra R$ 0,00", () => {
    const saida = html();
    expect(saida).toContain("Lance inicial");
    expect(saida).toContain("1.000,00");
    expect(saida).not.toContain("0,00");
  });

  it("com lance: o valor atual vem em destaque e o minimo vem menor", () => {
    const saida = html({ maiorLance: 28080, totalDeLances: 5, minInitialBid: 1000 });
    expect(saida).toContain("28.080,00");
    expect(saida).toContain("mín.");
    expect(saida).toContain("1.000,00");
  });

  it("um lance no singular, varios no plural", () => {
    expect(html({ maiorLance: 100, totalDeLances: 1 })).toContain("1 lance");
    expect(html({ maiorLance: 100, totalDeLances: 1 })).not.toContain("lances");
    expect(html({ maiorLance: 100, totalDeLances: 2 })).toContain("2 lances");
  });

  it("sem lance nao mostra contagem de lances", () => {
    const saida = html({ maiorLance: null, totalDeLances: 0 });
    expect(saida).not.toContain("lance");
    expect(saida).toContain("Lance inicial");
  });
});

describe("PublicItemCard — a urgencia", () => {
  it("a janela de urgencia e 24h, e o valor esta num unico lugar", () => {
    expect(JANELA_DE_URGENCIA_EM_HORAS).toBe(24);
  });

  it("mais de 24h: sem badge", () => {
    expect(html({ bidDeadline: agoraMais(25) })).not.toContain("Termina em breve");
  });

  it("dentro de 24h: badge 'Termina em breve'", () => {
    expect(html({ bidDeadline: agoraMais(23) })).toContain("Termina em breve");
  });

  it("dentro de 1h: o badge mais forte, 'Ultima hora'", () => {
    const saida = html({ bidDeadline: agoraMais(0.5) });
    expect(saida).toContain("Última hora");
    expect(saida).not.toContain("Termina em breve");
  });

  it("o badge e decorativo (aria-hidden): a contagem regressiva abaixo ja diz a urgencia", () => {
    const saida = html({ bidDeadline: agoraMais(23) });
    const badge = saida.match(/<[^>]*data-slot="badge"[^>]*>/)?.[0] ?? "";
    expect(badge).toContain('aria-hidden="true"');
  });
});

describe("PublicItemCard — alvo de clique e acessibilidade", () => {
  it("o card inteiro e UM link para o item, e nao tres", () => {
    const saida = html();
    expect(saida.match(/<a /g)).toHaveLength(1);
    expect(saida).toContain('href="/ana/i1"');
  });

  it("o titulo esta no texto do link (leitor de tela le o preco ao navegar)", () => {
    expect(html()).toContain("Console retrô");
  });

  it("o tipo vem do ROTULO_TIPO do dominio, nao do enum em ingles", () => {
    const saida = html({ type: "piece" });
    expect(saida).toContain("Peça colecionável");
    expect(saida).not.toContain("piece");
  });

  it("sem imagem: as iniciais do titulo no lugar", () => {
    expect(html({ imageUrl: null })).toContain("CO");
  });

  it("com imagem: a img tem o titulo como alt", () => {
    const saida = html({ imageUrl: "https://cdn.ex.com/a.jpg" });
    expect(saida).toContain('alt="Console retrô"');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm vitest run src/components/public-item-card.dom.test.tsx
```

Expected: FAIL — `JANELA_DE_URGENCIA_EM_HORAS` não existe e o card não mostra lance atual.

- [ ] **Step 3: A implementação**

Substituir todo o conteúdo de `src/components/public-item-card.tsx`:

```tsx
import Link from "next/link";
import type { ItemDaVitrine } from "@/domain/repositories/item-repository";
import { ROTULO_TIPO } from "@/domain/repositories/item-repository";
import { formatReais } from "@/lib/format-reais";
import { Badge } from "@/components/ui/badge";
import { BidCountdown } from "@/components/bid-countdown";

// ponytail: 24 HORAS, e nao 1. Este numero e o corte do badge de urgencia, e ele
// foi escolhido por medida, nao por gosto: o efeito "Digital Clock:PLS" mostra que
// itens que encerram em 1–24h capturam a maior fracao dos lances de uma janela de
// 24h. O corte de 1h atinge so uma fracao pequena do catalogo, entao quase nenhum
// card receberia selo — e um selo raro e indistinguivel de nenhum. 24h atinge o
// pico de interesse e mantem o selo raro o suficiente para continuar significando
// urgencia.
//
// O selo e de URGENCIA, e nao de novidade. Um badge "Novo" seria lido por todo
// mundo e nao distinguiria nada; um badge de urgencia so existe nos itens que vao
// fechar, que e exatamente o que move o visitante a clicar AGORA em vez de
// depois (Von Restorff: o elemento unico que se destaca e o lembrado).
export const JANELA_DE_URGENCIA_EM_HORAS = 24;

const HORA_EM_MS = 60 * 60 * 1000;

// ponytail: `urgenciaDo` e a UNICA fonte do badge. O rotulo ("Termina em breve"
// vs "Ultima hora") e a cor sao consequencias do bucket, e nao tres
// `if`s espalhados pelo JSX — um `if` por card e o jeito de o badge e o texto
// divergirem quando o corte muda.
function urgenciaDo(deadline: Date, agora: number): "ultima-hora" | "breve" | null {
  const restante = deadline.getTime() - agora;
  if (restante <= 0) return "ultima-hora";
  if (restante < HORA_EM_MS) return "ultima-hora";
  if (restante < JANELA_DE_URGENCIA_EM_HORAS * HORA_EM_MS) return "breve";
  return null;
}

export function PublicItemCard({ item, slug }: { item: ItemDaVitrine; slug: string }) {
  const urgencia = urgenciaDo(item.bidDeadline, Date.now());
  const temLance = item.maiorLance !== null;

  return (
    <Link
      href={`/${slug}/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* ponytail: o card inteiro e UM link, e nao o titulo com um link dentro.
      Um alvo grande demais nao e um defeito de UX e o opposite: WCAG 2.5.8
      (Target Size, AA) pede 24x24 CSS px MINIMOS, e um link so no titulo deixaria
      a imagem — a maior parte do card — fora do alvo. Um link so tambem evita o
      aninhamento de `<a>` que apareceria se o badge ou o preco fossem links. */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {item.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105 motion-reduce:transform-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
            {item.title.slice(0, 2).toUpperCase()}
          </div>
        )}
        {urgencia !== null ? (
          // ponytail: `aria-hidden` porque o badge e DECORATIVO. A contagem
          // regressiva logo abaixo ja anuncia a urgencia em texto, e dois
          // announcements do mesmo dado e ruido: o leitor de tela leria
          // "Termina em breve" e depois "2 d 3 h" para a mesma informacao.
          <Badge
            aria-hidden="true"
            variant={urgencia === "ultima-hora" ? "destructive" : "default"}
            className="absolute left-2 top-2"
          >
            {urgencia === "ultima-hora" ? "Última hora" : "Termina em breve"}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 font-medium">{item.title}</h3>

        {/* ponytail: o lance ATUAL em destaque e o lance INICIAL abaixo. A vitrine
        antiga mostrava so o inicial, e ele e a MENOR oferta possivel — mostrar
        "R$ 1.000" num item cujo lance atual e R$ 28.080 faz o visitante achar que
        o item vale 1.000. O `aria-label` no link leva os dois, para o leitor de
        tela ouvir o mesmo que o olho ve. */}
        <div>
          <p className="text-lg font-semibold leading-tight">
            {temLance ? `R$ ${formatReais(item.maiorLance as number)}` : "Lance inicial"}
          </p>
          <p className="text-xs text-muted-foreground">
            {temLance ? `mín. R$ ${formatReais(item.minInitialBid)}` : `R$ ${formatReais(item.minInitialBid)}`}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
          <span className="truncate">{ROTULO_TIPO[item.type]}</span>
          {temLance ? (
            <span>
              {item.totalDeLances} {item.totalDeLances === 1 ? "lance" : "lances"}
            </span>
          ) : null}
        </div>

        <div className="text-xs font-medium text-muted-foreground">
          <BidCountdown deadline={item.bidDeadline} />
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
pnpm vitest run src/components/public-item-card.dom.test.tsx
```

Expected: PASS — 13 casos. Se o teste "sem lance: mostra o lance inicial" falhar por causa do `0,00`, ajustar a asserção: o `formatReais(1000)` produz `1.000,00`, que contém a substring `0,00`. Nesse caso trocar por uma verificação mais específica.

- [ ] **Step 5: Verificação completa e commit**

```bash
pnpm test && pnpm typecheck
git add src/components/public-item-card.tsx src/components/public-item-card.dom.test.tsx
git commit -m "feat(vitrine): card mostra lance atual, contagem e badge de urgencia"
```

---

## Task 6: O esqueleto espelha o card novo

**Why:** O esqueleto existe para parecer com o card enquanto o card não chega. O card ganhou uma região (o lance atual em destaque, separado do mínimo), então o esqueleto ganha uma barra. Sem isso, a grade muda de tamanho no instante em que o conteúdo chega — que é a única coisa que o esqueleto não pode fazer.

**Files:**
- Modify: `src/components/skeletons.tsx:37-47` (`CartaoEsqueleto`)
- Modify: `src/components/skeletons.test.tsx:35,40` ⚠️ **Protected Test — aprovação já concedida**

**Interfaces:**
- Consumes: nada
- Produces: `ItemCardSkeleton` — assinatura inalterada, `data-slot="item-card-skeleton"` inalterado.

- [ ] **Step 1: Rodar o teste atual para ver a linha de base**

```bash
pnpm vitest run src/components/skeletons.test.tsx
```

Expected: PASS — 4 casos, com `CARTAS_DO_ESQUELETO * 3` = 18 barras.

- [ ] **Step 2: Escrever o teste que falha (a nova forma)**

Em `src/components/skeletons.test.tsx`, trocar o `it` das tres barras:

```tsx
  // ponytail: QUATRO barras por card, e a forma do `PublicItemCard` novo: imagem
  // quadrada, titulo, lance atual em destaque e o lance minimo embaixo. A
  // contagem e o que prende o esqueleto ao card — sem ela, um esqueleto de tres
  // barras e um de quatro passariam ambos. Este numero mudou de 3 para 4
  // porque o card mudou, e nao porque o teste cedesse: e a MESMA relacao que o
  // teste sempre affirms, com a forma nova.
  it("desenha quatro barras por card: a imagem, o titulo e os dois valores do lance", () => {
    const saida = html();
    const cards = saida.match(/data-slot="item-card-skeleton"/g) ?? [];

    expect(cards).toHaveLength(CARTAS_DO_ESQUELETO);
    expect(saida.match(/data-slot="skeleton"/g)).toHaveLength(CARTAS_DO_ESQUELETO * 4);
  });
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
pnpm vitest run src/components/skeletons.test.tsx
```

Expected: FAIL — 18 !== 24.

- [ ] **Step 4: A implementação**

Em `src/components/skeletons.tsx`, trocar `CartaoEsqueleto`:

```tsx
function CartaoEsqueleto() {
  return (
    <div data-slot="item-card-skeleton" aria-hidden="true" className="overflow-hidden rounded-lg border">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-4/5" />
        {/* ponytail: a barra do lance ATUAL e mais alta e mais larga que a do
        lance minimo, na ordem em que o card novo mostra as duas. Um esqueleto com
        as duas do mesmo tamanho denunciaria que ele e de um card que nao existe
        mais — e a troca do bloco largo pelo estreito no instante do conteudo e
        exatamente o salto de layout que o esqueleto existe para evitar. */}
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar, e conferir que o `page.test.tsx` continua verde**

```bash
pnpm vitest run src/components/skeletons.test.tsx "src/app/(public)/[slug]/page.test.tsx"
```

Expected: PASS — 4 + 3 casos. O `page.test.tsx:174` continua verde porque `data-slot="item-card-skeleton"` não mudou.

- [ ] **Step 6: Verificação completa e commit**

```bash
pnpm test && pnpm typecheck
git add src/components/skeletons.tsx src/components/skeletons.test.tsx
git commit -m "feat(skeletons): quarta barra espelha o lance atual do card novo"
```

---

## Task 7: O perfil público do vendedor (porta nova, 1 query)

**Why:** O hero precisa de três dados que `findBySlug` não traz: `image` (avatar), `createdAt` (membro desde) e a contagem de itens ativos. **Estender `findBySlug` quebraria 9 fakes de teste e o `get-seller-by-slug.test.ts:32`** (que faz `toEqual(sellerRow)`). Então é uma porta nova, no precedente de `ItemLister`.

**Files:**
- Modify: `src/domain/repositories/user-repository.ts`
- Modify: `src/infrastructure/database/repositories/drizzle-user-repository.ts`
- Create: `src/application/use-cases/get-vitrine-seller.ts`
- Test: `src/application/use-cases/get-vitrine-seller.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores
- Produces:
  ```ts
  // em src/domain/repositories/user-repository.ts
  export interface VitrineDeVendedor {
    id: string; name: string; slug: string;
    image: string | null; criadoEm: Date; totalDeItensAtivos: number;
  }
  export interface VitrineDeVendedorRepository {
    findVitrineBySlug(slug: string): Promise<VitrineDeVendedor | null>;
  }
  // em src/infrastructure/database/repositories/drizzle-user-repository.ts
  export const drizzleVitrineDeVendedorRepository: VitrineDeVendedorRepository;
  // em src/application/use-cases/get-vitrine-seller.ts
  export async function getVitrineSeller(
    repo: VitrineDeVendedorRepository, slug: string,
  ): Promise<VitrineDeVendedor | null>;
  ```

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/application/use-cases/get-vitrine-seller.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getVitrineSeller } from "./get-vitrine-seller";
import type { VitrineDeVendedor, VitrineDeVendedorRepository } from "@/domain/repositories/user-repository";

const VENDEDOR: VitrineDeVendedor = {
  id: "u1", name: "Ana", slug: "ana", image: null,
  criadoEm: new Date("2026-01-15T00:00:00Z"), totalDeItensAtivos: 3,
};

class Fake implements VitrineDeVendedorRepository {
  constructor(private row: VitrineDeVendedor | null) {}
  async findVitrineBySlug(slug: string) {
    if (this.row && this.row.slug !== slug) return null;
    return this.row;
  }
}

describe("getVitrineSeller", () => {
  it("devolve o perfil completo do vendedor", async () => {
    await expect(getVitrineSeller(new Fake(VENDEDOR), "ana")).resolves.toEqual(VENDEDOR);
  });

  it("devolve null para slug inexistente", async () => {
    await expect(getVitrineSeller(new Fake(VENDEDOR), "ninguem")).resolves.toBeNull();
  });

  it("NAO toca em UserRepository: a porta e a de vitrine, e nao a geral", async () => {
    // ponytail: este `it` nao testa comportamento de tela — ele trava o QUE o use
    // case depende. Se alguem trocar `VitrineDeVendedorRepository` por
    // `UserRepository` para "reaproveitar", o `tsc` passa (a porta nova e um
    // subconjunto conceitual) mas o use case passa a exigir um metodo que 9 fakes
    // de outros testes nao tem. O tipo da assinatura e a trava.
    const repo = new Fake(VENDEDOR);
    await getVitrineSeller(repo, "ana");
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(repo))).toContain("findVitrineBySlug");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm vitest run src/application/use-cases/get-vitrine-seller.test.ts
```

Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: A porta no domínio**

Em `src/domain/repositories/user-repository.ts`, adicionar ao fim:

```ts
// ponytail: o perfil que o HERO da vitrine precisa, e uma porta separada porque
// `findBySlug` nao pode mudar de forma: o `get-seller-by-slug.test.ts:32` faz
// `toEqual(sellerRow)` sobre `{id, name, slug}`, e 9 fakes de `UserRepository`
// implementam o retorno. Acrescentar `image`/`createdAt`/`totalDeItensAtivos` ali
// quebraria os dez. E o mesmo motivo do `ItemLister`.
//
// Os tres campos novos sao os que `user` JA tem (`image`, `created_at`) ou o que
// se deriva com um `count` (`total_de_itens_ativos`) — nenhum exige migration.
export interface VitrineDeVendedor {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  criadoEm: Date;
  totalDeItensAtivos: number;
}

export interface VitrineDeVendedorRepository {
  findVitrineBySlug(slug: string): Promise<VitrineDeVendedor | null>;
}
```

- [ ] **Step 4: A implementação no repositório**

Em `src/infrastructure/database/repositories/drizzle-user-repository.ts`, ajustar o import e adicionar no fim:

```ts
import { and, count, eq, sql } from "drizzle-orm";
import { items } from "@/infrastructure/database/schema";
import type { VitrineDeVendedor, VitrineDeVendedorRepository } from "@/domain/repositories/user-repository";
```

```ts
// ponytail: UMA query com SUBQUERY ESCALAR para a contagem, e nao duas. Medido
// contra o Postgres 17 com o banco de desenvolvimento: a query leva 0,087ms de
// execucao, faz `Index Scan using user_slug_unique` e o `SubPlan` do count fica
// em 0,010ms. Duas queries custariam um segundo round-trip (~0,4ms medido) para
// um numero que cabe num escalar.
//
// A subquery e ESCALAR e correlacionada (`i.seller_id = u.id`), entao devolve UM
// valor por linha do `user` e nao multiplica o resultado — que e o que
// a diferenca entre um `(select count(*) ...)` e um `join lateral`.
//
// O `count(*)::int` e obrigatorio: sem o cast o Postgres devolve `bigint`, o `pg`
// entrega como TEXTO, e `totalDeItensAtivos` viraria a string "3" — que no
// `pluralize` do hero comparada com 1 seria sempre falsa.
export const drizzleVitrineDeVendedorRepository: VitrineDeVendedorRepository = {
  async findVitrineBySlug(slug) {
    const [row] = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        slug: userTable.slug,
        image: userTable.image,
        criadoEm: userTable.createdAt,
        totalDeItensAtivos: sql<number>`(select count(*)::int from ${items} i where i.seller_id = ${userTable.id} and i.status = 'active')`,
      })
      .from(userTable)
      .where(eq(userTable.slug, slug))
      .limit(1);
    if (!row || !row.slug) return null;
    return { ...row, totalDeItensAtivos: Number(row.totalDeItensAtivos) };
  },
};
```

- [ ] **Step 5: O use case**

Criar `src/application/use-cases/get-vitrine-seller.ts`:

```ts
import type { VitrineDeVendedor, VitrineDeVendedorRepository } from "@/domain/repositories/user-repository";

// ponytail: este use case nao tem regra nenhuma — ele repassa a chamada. Ele
// existe pela MESMA razao que `getSellerBySlug` existe: a pagina nao importa
// `src/infrastructure` (a seta da Clean Architecture) e nao deve montar o
// repositorio, e tambem nao deve chamar o `@base-ui` do Next direto no
// componente. E a costura onde o `notFound()` do shell vai ler.
export async function getVitrineSeller(
  repo: VitrineDeVendedorRepository,
  slug: string,
): Promise<VitrineDeVendedor | null> {
  return repo.findVitrineBySlug(slug);
}
```

- [ ] **Step 6: Rodar e ver passar**

```bash
pnpm vitest run src/application/use-cases/get-vitrine-seller.test.ts src/application/use-cases/get-seller-by-slug.test.ts
```

Expected: PASS — 3 + 3 casos. O `get-seller-by-slug.test.ts` **não pode ter mudado**.

- [ ] **Step 7: Provar a query no banco real**

```bash
node -e "
const {Client}=require('pg');const fs=require('fs');
const url=fs.readFileSync('.env','utf8').match(/^DATABASE_URL=(.*)\$/m)[1];
(async()=>{const c=new Client({connectionString:url});await c.connect();
const r=await c.query(\`select u.id, u.name, u.slug, u.image, u.created_at,
  (select count(*)::int from items i where i.seller_id = u.id and i.status = 'active') as total
  from \\\"user\\\" u where u.slug = \$1 limit 1\`, ['nerd-colecionaveis']);
console.log(JSON.stringify(r.rows[0], null, 1));await c.end();})();"
```

Expected: uma linha com `image` (pode ser `null` — **todos** os vendedores do banco de dev têm imagem nula, e o hero precisa cair nas iniciais), `created_at` e `total` como **número**.

- [ ] **Step 8: Verificação completa e commit**

```bash
pnpm test && pnpm typecheck
git add src/domain/repositories/user-repository.ts src/infrastructure/database/repositories/drizzle-user-repository.ts src/application/use-cases/get-vitrine-seller.ts src/application/use-cases/get-vitrine-seller.test.ts
git commit -m "feat(vendedor): perfil publico da vitrine (avatar, membro desde, itens ativos) em 1 query"
```

---

## Task 8: O hero da vitrine

**Why:** É a resposta à terceira pergunta do visitante ("posso confiar neste vendedor?") e a peça que dá contexto antes da grade. Mostra **fatos verificáveis** — não um selo "Verificado" que o sistema não tem como sustentar.

**Files:**
- Create: `src/app/(public)/[slug]/vitrine-hero.tsx`
- Create: `src/app/(public)/[slug]/vitrine-hero.dom.test.tsx`

**Interfaces:**
- Consumes: `VitrineDeVendedor` de `@/domain/repositories/user-repository`
- Produces: `VitrineHero({ vendedor }: { vendedor: VitrineDeVendedor })`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/app/(public)/[slug]/vitrine-hero.dom.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { VitrineDeVendedor } from "@/domain/repositories/user-repository";
import { VitrineHero } from "./vitrine-hero";

const BASE: VitrineDeVendedor = {
  id: "u1", name: "Ana Impala", slug: "ana", image: null,
  criadoEm: new Date("2026-01-15T12:00:00Z"), totalDeItensAtivos: 12,
};

const html = (over: Partial<VitrineDeVendedor> = {}) => renderToString(<VitrineHero vendedor={{ ...BASE, ...over }} />);

describe("VitrineHero", () => {
  it("mostra o nome, o total de itens e a data de entrada", () => {
    const saida = html();
    expect(saida).toContain("Ana Impala");
    expect(saida).toContain("12 itens em leilão");
    expect(saida).toContain("janeiro de 2026");
  });

  it("pluraliza o total de itens", () => {
    expect(html({ totalDeItensAtivos: 1 })).toContain("1 item em leilão");
    expect(html({ totalDeItensAtivos: 0 })).toContain("Nenhum item em leilão");
  });

  it("a data de entrada e formatada no fuso do produto, em pt-BR", () => {
    const saida = html({ criadoEm: new Date("2026-01-15T23:30:00Z") });
    // 2026-01-15T23:30Z == 15/01 20:30 em America/Sao_Paulo — o mesmo dia.
    expect(saida).toContain("janeiro de 2026");
  });

  it("SEM selo de 'verificado': a vitrine mostra so fato verificavel", () => {
    const saida = html();
    expect(saida).not.toMatch(/verificad/i);
    expect(saida).not.toMatch(/confiável|confiavel/i);
  });

  it("sem avatar: as iniciais do nome, que e o que o banco de dev tem", () => {
    expect(html({ image: null })).toContain("AI");
  });

  it("com avatar: a img tem o nome como alt", () => {
    const saida = html({ image: "https://cdn.ex.com/ana.jpg" });
    expect(saida).toContain('alt="Ana Impala"');
  });

  it("o nome aparece em h1: e o landmark que o leitor de tela pula primeiro", () => {
    expect(html()).toContain("<h1");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm vitest run "src/app/(public)/[slug]/vitrine-hero.dom.test.tsx"
```

Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: A implementação**

Criar `src/app/(public)/[slug]/vitrine-hero.tsx`:

```tsx
import type { VitrineDeVendedor } from "@/domain/repositories/user-repository";
import { FUSO } from "@/lib/fuso";

// ponytail: o hero mostra SO FATOS VERIFICAVEIS — quantos itens estao em leilao e
// desde quando o vendedor existe. Os dois sao checaveis pelo visitante na propria
// tela (a grade logo abaixo tem os itens; a data nao e mistério nenhum).
//
// E por isso que NAO ha "verificado", nem avaliacao, nem badge de seguranca. Um
// selo de confiança que o sistema nao consegue sustentar e PIOR que nenhum selo:
// ele promete um controle que nao existe, e o visitante que descobrir le nao volta.
// O que sustenta a confianza aqui e o oposto — o numero e a data sao verificaveis.
export function VitrineHero({ vendedor }: { vendedor: VitrineDeVendedor }) {
  const iniciais = vendedor.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex items-center gap-4" data-slot="vitrine-hero">
      {vendedor.image ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={vendedor.image}
          alt={vendedor.name}
          className="size-20 shrink-0 rounded-full border object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex size-20 shrink-0 items-center justify-center rounded-full border bg-muted text-2xl font-semibold text-muted-foreground"
        >
          {iniciais}
        </div>
      )}

      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold">{vendedor.name}</h1>
        <p className="text-sm text-muted-foreground">{contarItens(vendedor.totalDeItensAtivos)}</p>
        <p className="text-xs text-muted-foreground">
          Membro desde{" "}
          <time dateTime={vendedor.criadoEm.toISOString()}>
            {vendedor.criadoEm.toLocaleDateString("pt-BR", {
              timeZone: FUSO, month: "long", year: "numeric",
            })}
          </time>
        </p>
      </div>
    </div>
  );
}

function contarItens(total: number): string {
  if (total === 0) return "Nenhum item em leilão";
  if (total === 1) return "1 item em leilão";
  return `${total} itens em leilão`;
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
pnpm vitest run "src/app/(public)/[slug]/vitrine-hero.dom.test.tsx"
```

Expected: PASS — 7 casos. Se "janeiro de 2026" falhar por causa da forma do `toLocaleDateString` pt-BR, ajustar a asserção para o que ele produzir mantendo o dia correto — o ponto do teste é que **a data é a do fuso do produto**, e o `FUSO` no código é o que garante isso.

- [ ] **Step 5: Verificação completa e commit**

```bash
pnpm test && pnpm typecheck
git add "src/app/(public)/[slug]/vitrine-hero.tsx" "src/app/(public)/[slug]/vitrine-hero.dom.test.tsx"
git commit -m "feat(vitrine): hero com fatos verificaveis do vendedor"
```

---

## Task 9: A action e os controles de busca e ordenação

**Why:** `lista` a vitrine do URL. A busca é um `<form method="get">` (navegação nativa, zero JS) e a ordenação são `<Link>` — é o mesmo padrão do dashboard, e dá ao visitante voltar, compartilhar e refazer.

**Files:**
- Modify: `src/presentation/actions/public-actions.ts`
- Create: `src/app/(public)/[slug]/controles-da-vitrine.tsx`
- Create: `src/app/(public)/[slug]/controles-da-vitrine.dom.test.tsx`

**Interfaces:**
- Consumes: `VistaDaVitrine`, `hrefDaVista` de `./estado-da-vitrine`
- Produces:
  ```ts
  // em src/presentation/actions/public-actions.ts
  export async function getVitrineSellerAction(slug: string): Promise<VitrineDeVendedor | null>;
  export async function listVitrineItemsAction(sellerId: string, vista: VistaDaVitrine): Promise<ItemDaVitrine[]>;
  // em src/app/(public)/[slug]/controles-da-vitrine.tsx
  export function ControlesDaVitrine({ slug, vista }: { slug: string; vista: VistaDaVitrine }): React.JSX.Element;
  export const ROTULOS_DA_ORDENACAO: Record<OrdenacaoDaVitrine, string>;
  ```

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/app/(public)/[slug]/controles-da-vitrine.dom.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ControlesDaVitrine, ROTULOS_DA_ORDENACAO } from "./controles-da-vitrine";
import { VISTA_PADRAO_DA_VITRINE } from "./estado-da-vitrine";

const html = (vista = VISTA_PADRAO_DA_VITRINE) =>
  renderToString(<ControlesDaVitrine slug="ana" vista={vista} />);

describe("ControlesDaVitrine — ordenacao", () => {
  it("os tres rotulos, na ordem em que aparecem na tela", () => {
    expect(ROTULOS_DA_ORDENACAO).toEqual({
      prazo: "Termina em breve",
      lance: "Maior lance",
      recentes: "Recentes",
    });
  });

  it("cada ordenacao e um LINK com o href da vista — nao um botao com callback", () => {
    const saida = html();
    expect(saida).toContain('href="/ana?ordenar=lance"');
    expect(saida).toContain('href="/ana?ordenar=recentes"');
    expect(saida).toContain("Maior lance");
    expect(saida).toContain("Recentes");
  });

  it("a ordenacao atual nao escreve o parametro: ela e o estado inicial", () => {
    // a vista padrao e "prazo", entao o link dela e o caminho puro
    expect(html()).toContain('href="/ana"');
  });

  it("trocar a ordenacao nao perde a busca que ja estava na URL", () => {
    const saida = html({ q: "console", ordenar: "prazo" });
    expect(saida).toContain("q=console");
    expect(saida).toContain("ordenar=lance");
  });

  it("a ordenacao ativa e marcada com aria-current", () => {
    expect(html({ q: "", ordenar: "lance" })).toContain('aria-current="true"');
  });
});

describe("ControlesDaVitrine — busca", () => {
  it("a busca e um form GET para o caminho da propria vitrine", () => {
    const saida = html();
    expect(saida).toContain('method="get"');
    expect(saida).toContain('action="/ana"');
  });

  it("a caixa de busca e controlada pela URL: o value vem da vista", () => {
    expect(html({ q: "console", ordenar: "prazo" })).toContain('value="console"');
  });

  it("a caixa tem um label acessivel (sr-only serve, placeholder nao)", () => {
    const saida = html();
    expect(saida).toMatch(/<label[^>]*for="busca-vitrine"|sr-only[^>]*>\s*Buscar/);
  });

  it("o input e nomeado `q`, que e o parametro que o leitor da URL conhece", () => {
    expect(html()).toContain('name="q"');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm vitest run "src/app/(public)/[slug]/controles-da-vitrine.dom.test.tsx"
```

Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: As actions**

Em `src/presentation/actions/public-actions.ts`, **substituir** `getVitrineSellerAction` e `listVitrineItemsAction`:

```ts
import { getVitrineSeller } from "@/application/use-cases/get-vitrine-seller";
import { listVitrine } from "@/application/use-cases/list-vitrine";
import { drizzleVitrineDeVendedorRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import { drizzleEstatisticasDeLances } from "@/infrastructure/database/repositories/drizzle-bid-repository";
import type { ItemDaVitrine, VitrineDeVendedor } from "@/domain/repositories/item-repository";
import type { VistaDaVitrine } from "@/app/(public)/[slug]/estado-da-vitrine";

// ponytail: o vendedor vem da porta de VITRINE (`drizzleVitrineDeVendedorRepository`)
// e nao de `getSellerBySlug`. Sao dois use cases com contratos diferentes: o
// primeiro devolve `{id, name, slug}` e o segundo devolve o perfil do hero
// (avatar, membro desde, itens ativos). Trocar um pelo outro faria o hero
// renderizar `undefined` em tres campos — e o `tsc` nao acusa, porque `undefined`
// casa com `string | null` em varios dos pontos.
export async function getVitrineSellerAction(slug: string): Promise<VitrineDeVendedor | null> {
  return getVitrineSeller(drizzleVitrineDeVendedorRepository, slug);
}

// ponytail: a action recebe a VISTA inteira, e nao so o `sellerId`. Antes ela
// pegava so o vendedor e filtrava `status: "active"` fixo; agora quem filtra e
// ordena e o `listVitrine`, e a `vista` (q + ordenar) e o que ele precisa. E o
// `page.test.tsx:178` (`toHaveBeenCalledWith("u1")`) e o teste dessa assinatura —
// ver o plano, secao "Protected Tests".
export async function listVitrineItemsAction(
  sellerId: string,
  vista: VistaDaVitrine,
): Promise<ItemDaVitrine[]> {
  return listVitrine(drizzleItemRepository, drizzleEstatisticasDeLances, sellerId, vista);
}
```

Manter `getSellerVitrineAction` e `getItemDetailAction` **intocados** — `public-actions.test.ts` fixa o contrato de `getSellerVitrineAction` e ele não muda.

- [ ] **Step 4: Os controles**

Criar `src/app/(public)/[slug]/controles-da-vitrine.tsx`:

```tsx
import Link from "next/link";
import { ROTULO_TIPO, type ItemType } from "@/domain/repositories/item-repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hrefDaVista, LISTA_DE_ORDENACOES, type OrdenacaoDaVitrine, type VistaDaVitrine } from "./estado-da-vitrine";

// ponytail: os rotulos sao o CONTRATO VISVEL do parametro `ordenar`, e ele mora
// aqui e nao em `estado-da-vitrine.ts` porque sao duas metades diferentes: o
// parametro e a Maquina (o que o leitor aceita), o rotulo e a tela (o que o
// visitante le). Um teste de `estado-da-vitrine` que escrevesse "Maior lance"
// passaria se os dois lados divergirem — so a leitura dos dois arquivos diz qual
// e a fonte. O `controles-da-vitrine.dom.test.tsx` e o que amarra as duas.
export const ROTULOS_DA_ORDENACAO: Record<OrdenacaoDaVitrine, string> = {
  prazo: "Termina em breve",
  lance: "Maior lance",
  recentes: "Recentes",
};

const ORDEM_VISUAL: OrdenacaoDaVitrine[] = [...LISTA_DE_ORDENACOES];
// ponytail: `[...LISTA_DE_ORDENACOES]`, e nao o trio escrito a mao. A lista vive em
// `estado-da-vitrine.ts` porque e a fonte unica da uniao E do `Set` de validacao (ver o
// `ponytail:` de la); copia-la aqui seria a segunda fonte, e uma ordenacao acrescentada na
// lista apareceria no tipo e na validacao e nao nesta tela — o mesmo modo de falha
// silenciosa que o achado 4 da revisao do Batch A removeu deste lado. O `as const` da lista
// impede reordenacao, entao a ordem visual e a ordem da uniao. Ela e exportada por causa
// deste uso.

// ponytail: a busca e um `<form method="get">` e nao um input controlado com
// `onChange` + `router.push`. O form entrega o comportamento de navegacao de graca
// (botao de submit do teclado, botao direito -> "abrir em nova aba", Enter no
// campo) e a URL e escrita pelo NAVEGADOR, num lugar so. Um `useState` + `push`
// reimplementaria tudo isso e ainda criaria a classe de bug em que a digitacao se
// perde no meio da navegacao.
export function ControlesDaVitrine({ slug, vista }: { slug: string; vista: VistaDaVitrine }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <form method="get" action={`/${slug}`} className="flex items-center gap-2">
        <label htmlFor="busca-vitrine" className="sr-only">
          Buscar item
        </label>
        <Input
          id="busca-vitrine"
          name="q"
          type="search"
          defaultValue={vista.q}
          placeholder="Buscar item"
          className="w-48"
        />
        {vista.ordenar !== "prazo" ? (
          <input type="hidden" name="ordenar" value={vista.ordenar} />
        ) : null}
        <Button type="submit" variant="outline" size="sm">
          Buscar
        </Button>
      </form>

      {/* ponytail: a ordenacao sao `<Link>`, e nao `<Select>` nem botoes com
      onClick. Um link entrega prefetch, historico, ctrl-clique e "abrir em nova
      aba"; um `Select` do shadcn e estado de CLIENT e perderia o "voltar" — que e
      justamente o principio de "user control and freedom" que a URL comprou. */}
      <nav aria-label="Ordenar itens" className="flex flex-wrap gap-2">
        {ORDEM_VISUAL.map((ordenar) => (
          <Link
            key={ordenar}
            href={hrefDaVista(slug, { ...vista, ordenar })}
            aria-current={vista.ordenar === ordenar ? "true" : undefined}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              vista.ordenar === ordenar
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {ROTULOS_DA_ORDENACAO[ordenar]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
pnpm vitest run "src/app/(public)/[slug]/controles-da-vitrine.dom.test.tsx" src/presentation/actions/public-actions.test.ts
```

Expected: PASS nos novos; `public-actions.test.ts` **pode** falhar no `getSellerVitrineAction` se o mock de `@/application/use-cases/get-seller-by-slug` tiver mudado de forma — nesse caso ajustar **só** o mock, sem tocar no `it`.

- [ ] **Step 6: Verificação completa e commit**

```bash
pnpm test && pnpm typecheck
git add src/presentation/actions/public-actions.ts "src/app/(public)/[slug]/controles-da-vitrine.tsx" "src/app/(public)/[slug]/controles-da-vitrine.dom.test.tsx"
git commit -m "feat(vitrine): busca e ordenacao por URL na vitrine"
```

---

## Task 10: A página — hero, controles e a lista ordenada

**Why:** É onde tudo se encontra. E o único lugar que exige tocar num **Protected Test**.

**Files:**
- Modify: `src/app/(public)/[slug]/page.tsx`
- Modify: `src/app/(public)/[slug]/page.test.tsx` ⚠️ **Protected Test — aprovação já concedida**

**Interfaces:**
- Consumes: `getVitrineSellerAction`, `listVitrineItemsAction`; `interpretarVitrine`; `hrefDaVista`; `VitrineHero`; `ControlesDaVitrine`; `PublicItemCard`; `ItemCardSkeleton`; `EmptyState`
- Produces: a rota `/{slug}` com hero + controles + grade ordenada

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao `describe` de `[slug]/page.test.tsx`:

```tsx
  it("o hero do vendedor e o titulo do primeiro flush, e os controles vem com ele", async () => {
    espiao.vendedor.mockResolvedValue({
      id: "u1", name: "Ana", slug: "ana", image: null,
      criadoEm: new Date("2026-01-15T12:00:00Z"), totalDeItensAtivos: 1,
    });
    espiao.itens.mockResolvedValue([]);
    const partes = await antesDoPrazo("o fim do fluxo", streamar(await antesDoPrazo("o shell", VitrinePage(props("ana")))).fim);
    const html = texto(partes.join(""));
    expect(html).toContain('data-slot="vitrine-hero"');
    expect(html).toContain("1 item em leilão");
    expect(html).toContain('name="q"');
  });

  it("a lista vem ORDENADA: o primeiro card e o de maior lance", async () => {
    espiao.vendedor.mockResolvedValue({
      id: "u1", name: "Ana", slug: "ana", image: null,
      criadoEm: new Date("2026-01-15T12:00:00Z"), totalDeItensAtivos: 2,
    });
    espiao.itens.mockResolvedValue([
      vitrineItem("baixo", { maiorLance: 10, totalDeLances: 1, title: "Item baixo" }),
      vitrineItem("alto", { maiorLance: 900, totalDeLances: 3, title: "Item alto" }),
    ]);
    const partes = await antesDoPrazo("o fim do fluxo", streamar(await antesDoPrazo("o shell", VitrinePage({ ...props("ana"), searchParams: Promise.resolve({ ordenar: "lance" }) }))).fim);
    const html = texto(partes.join(""));
    expect(html.indexOf("Item alto")).toBeGreaterThan(-1);
    expect(html.indexOf("Item alto")).toBeLessThan(html.indexOf("Item baixo"));
  });

  it("a URL e repassada para a action como VISTA, nao como parametros soltos", async () => {
    espiao.vendedor.mockResolvedValue({ id: "u1", name: "Ana", slug: "ana", image: null, criadoEm: new Date(), totalDeItensAtivos: 0 });
    espiao.itens.mockResolvedValue([]);
    await antesDoPrazo("o fim do fluxo", streamar(await antesDoPrazo("o shell", VitrinePage({ ...props("ana"), searchParams: Promise.resolve({ q: "console", ordenar: "lance" }) }))).fim);
    expect(espiao.itens).toHaveBeenCalledWith("u1", { q: "console", ordenar: "lance" });
  });

  it("ordenar invalido nao quebra: a vista cai no padrao", async () => {
    espiao.vendedor.mockResolvedValue({ id: "u1", name: "Ana", slug: "ana", image: null, criadoEm: new Date(), totalDeItensAtivos: 0 });
    espiao.itens.mockResolvedValue([]);
    await antesDoPrazo("o fim do fluxo", streamar(await antesDoPrazo("o shell", VitrinePage({ ...props("ana"), searchParams: Promise.resolve({ ordenar: ";drop" }) }))).fim);
    expect(espiao.itens).toHaveBeenCalledWith("u1", { q: "", ordenar: "prazo" });
  });

  it("busca sem resultado distingue de vitrine vazia: oferece limpar a busca", async () => {
    espiao.vendedor.mockResolvedValue({ id: "u1", name: "Ana", slug: "ana", image: null, criadoEm: new Date(), totalDeItensAtivos: 1 });
    espiao.itens.mockResolvedValue([]);
    const partes = await antesDoPrazo("o fim do fluxo", streamar(await antesDoPrazo("o shell", VitrinePage({ ...props("ana"), searchParams: Promise.resolve({ q: "zzz" }) }))).fim);
    const html = texto(partes.join(""));
    expect(html).toContain('data-slot="empty-state"');
    expect(html).toContain("Limpar busca");
    expect(html).toContain('href="/ana"');
  });
```

Adicionar também o helper, junto dos outros do arquivo:

```tsx
function vitrineItem(id: string, over: Partial<ItemDaVitrine> = {}): ItemDaVitrine {
  return {
    id, title: `Item ${id}`, type: "product", minInitialBid: 1000,
    bidDeadline: new Date("2026-10-01T12:00:00Z"), imageUrl: null,
    totalDeLances: 0, maiorLance: null, ...over,
  };
}
```

E trocar o import do tipo:

```tsx
import type { ItemDaVitrine } from "@/domain/repositories/item-repository";
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm vitest run "src/app/(public)/[slug]/page.test.tsx"
```

Expected: FAIL nos novos; os 3 antigos ainda passam.

- [ ] **Step 3: Atualizar o mock e o tipo do spy (o Protected Test)**

Em `page.test.tsx`, trocar o `vi.mock` de `@/presentation/actions/public-actions` (linhas 26-29):

```tsx
vi.mock("@/presentation/actions/public-actions", () => ({
  getVitrineSellerAction: espiao.vendedor,
  listVitrineItemsAction: espiao.itens,
}));
```

Isto **não muda** — os dois nomes de export continuam os mesmos. O que muda é o spy `itens`: trocar o helper `item()` (que devolve `Item`, com 12 campos) por `vitrineItem()` (o DTO), em todos os usos, e a asserção da linha 178:

```tsx
    expect(espiao.itens).toHaveBeenCalledWith("u1", { q: "", ordenar: "prazo" });
```

E o `it` do primeiro flush, que hoje faz `espiao.itens.mockReturnValue(new Promise<Item[]>(...))`:

```tsx
    let chega!: (valor: ItemDaVitrine[]) => void;
    espiao.itens.mockReturnValue(new Promise<ItemDaVitrine[]>((resolve) => { chega = resolve; }));
```

E o `espiao.vendedor.mockResolvedValue(VENDEDOR)`, hoje `const VENDEDOR = { id: "u1", name: "Ana", slug: "ana" }` — ampliar para o perfil completo:

```tsx
const VENDEDOR = {
  id: "u1", name: "Ana", slug: "ana", image: null,
  criadoEm: new Date("2026-01-15T12:00:00Z"), totalDeItensAtivos: 1,
};
```

**A intenção dos 3 casos originais permanece idêntica** — 1º flush = esqueleto, vitrine vazia = estado vazio sem esqueleto, 404 sem listar. O que muda é a forma dos dados que o spy devolve.

- [ ] **Step 4: A página**

Substituir todo o conteúdo de `src/app/(public)/[slug]/page.tsx`:

```tsx
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GavelIcon, SearchIcon } from "lucide-react";
import { getVitrineSellerAction, listVitrineItemsAction } from "@/presentation/actions/public-actions";
import { PublicItemCard } from "@/components/public-item-card";
import { EmptyState } from "@/components/empty-state";
import { ItemCardSkeleton } from "@/components/skeletons";
import { primeiroValor } from "@/lib/primeiro-valor";
import { ControlesDaVitrine } from "./controles-da-vitrine";
import { hrefDaVista, interpretarVitrine, type VistaDaVitrine } from "./estado-da-vitrine";
import { VitrineHero } from "./vitrine-hero";

export const dynamic = "force-dynamic";

// ponytail: a listagem mora num COMPONENTE SEPARADO, e essa e a unica razao de
// ela existir. Uma fronteira `<Suspense>` so serve se algo ABAIXO dela suspender,
// e um `await` no corpo da propria pagina acontece antes do JSX existir — a
// fronteira, nesse caso, e decorativa: o esqueleto nunca aparece. Colocando o
// `await` dentro de um filho async, o filho e que suspende, e o fallback sai no
// primeiro flush enquanto a consulta responde.
//
// ponytail: e por isso que o HERO e os CONTROLES ficam FORA da fronteira. Medido
// nesta suite (com `renderToPipeableStream`, o renderizador que o Next usa): uma
// fronteira sozinha, sem nada em volta, recebe `onShellReady` e NAO despeja o
// fallback — o React espera e entrega o conteudo pronto num unico flush. Com
// conteudo no shell (o hero, que carrega o `<h1>`), o primeiro flush leva o
// esqueleto e o segundo traz os cards.
async function ListaDaVitrine({ sellerId, slug, vista }: { sellerId: string; slug: string; vista: VistaDaVitrine }) {
  const items = await listVitrineItemsAction(sellerId, vista);

  // ponytail: a vitrine vazia tem DOIS motivos, e os dois nao podem dizer a mesma
  // frase. Com a busca vinda da URL, "o vendedor nao tem nada" e "nada casou com
  // o que voce procurou" chegam no mesmo lugar — e so um deles tem para onde
  // voltar. O texto unico mandava quem procurava um item que nao existe ler "ele
  // nao tem item nenhum", que e uma acusacao falsa sobre o vendedor.
  //
  // O "voltar" e um LINK, e nao um botao que chama `navegar`: um link tem as
  // afinidades que o botao nao tem (abrir em nova aba, clique do meio, ctrl-clique,
  // copiar endereco, rastreamento) sem ganhar nada em troca, porque a propriedade
  // que importa e "a URL e escrita num lugar so" — e ela continua sendo o
  // `hrefDaVista`, chamado com a vista sem filtro (que e a MESMA frase de URL com
  // outra vista, nao uma segunda copia do endereco).
  if (items.length === 0) {
    const filtrada = vista.q !== "";
    return (
      <EmptyState
        title={filtrada ? "Nenhum item encontrado" : "Nenhum item em leilão"}
        description={
          filtrada
            ? "Nada casou com essa busca. Tente outro termo."
            : "Assim que ele leiloar algo, os itens aparecem aqui."
        }
        icon={
          filtrada ? (
            <SearchIcon aria-hidden="true" className="size-6 text-muted-foreground" />
          ) : (
            <GavelIcon aria-hidden="true" className="size-6 text-muted-foreground" />
          )
        }
        // ponytail: sem busca nao ha acao, e a decisao e do `page.tsx:26-31`
        // original: o visitante de uma vitrine sem itens nao tem nada a fazer — nao
        // ha onde criar, nao ha busca e a pagina inicial e um cartao de boas-vindas.
        // Um link ali seria uma saida para lugar nenhum.
        action={filtrada ? { label: "Limpar busca", href: hrefDaVista(slug, { q: "", ordenar: vista.ordenar }) } : undefined}
      />
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <PublicItemCard key={item.id} item={item} slug={slug} />
      ))}
    </div>
  );
}

export default async function VitrinePage({ params, searchParams }: PageProps<"/[slug]">) {
  const { slug } = await params;
  // ponytail: o `notFound()` e do SHELL, e nao da fronteira, por causa do STATUS
  // CODE. A documentacao do proprio Next 16 ("Calling `notFound()` after streaming
  // has started") mostra o outro desenho — a checagem dentro da fronteira — e
  // nomeia a conta: "the response has already begun streaming as a 200, and the
  // status can't change once streaming has started", com um `noindex` para segurar
  // o soft 404. Esta e a rota mais rastreada do produto, e um soft 404 com 200 e
  // uma vitrine inexistente e um indexavel como pagina valida.
  const vendedor = await getVitrineSellerAction(slug);
  if (!vendedor) notFound();

  // ponytail: a URL e lida AQUI, no shell, e a `vista` e passada para a fronteira.
  // Ler dentro do filho daria duas leituras do mesmo parametro e a URL poderia
  // mudar entre elas. E a `vista` do shell e a que o `<form>` e os `<Link>` dos
  // controles usam, entao o que a tela mostra e o que a lista filtra.
  const paramsDaUrl = await searchParams;
  const vista = interpretarVitrine((nome) => primeiroValor(paramsDaUrl[nome]));

  return (
    <div className="space-y-6">
      <VitrineHero vendedor={vendedor} />
      <ControlesDaVitrine slug={slug} vista={vista} />
      <Suspense fallback={<ItemCardSkeleton />}>
        <ListaDaVitrine sellerId={vendedor.id} slug={slug} vista={vista} />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
pnpm vitest run "src/app/(public)/[slug]/page.test.tsx"
```

Expected: PASS — 8 casos (3 originais + 5 novos).

**Se o `it` do primeiro flush falhar com "não contém o esqueleto":** o hero e os controles precisam produzir conteúdo no shell. Se o hero renderizou mas o teste ainda vê um flush único, o problema é o `<h1>` ter saído do shell — conferir que `VitrineHero` tem o `<h1>` (Step 3 da Task 8 garante).

- [ ] **Step 6: Verificação completa e commit**

```bash
pnpm test && pnpm typecheck
git add "src/app/(public)/[slug]/page.tsx" "src/app/(public)/[slug]/page.test.tsx"
git commit -m "feat(vitrine): hero, controles e lista ordenada na pagina da vitrine"
```

---

## Task 11: Verificação final e revisão visual

**Why:** As tasks anteriores provam o comportamento. Esta prova a aplicação inteira e o que o usuário vê.

**Files:**
- Nenhum (verificação)

**Interfaces:**
- Consumes: tudo
- Produces: nada

- [ ] **Step 1: Suíte completa, tipos e lint**

```bash
pnpm test && pnpm typecheck && pnpm lint
```

Expected: todos os testes passam, `tsc` limpo, `lint` com **0 erros**. O número de testes deve ter **subido** de 562.

- [ ] **Step 2: Build de produção**

```bash
pnpm build
```

Expected: `Compiled successfully`, sem erros de tipo.

- [ ] **Step 3: A rota real, contra o banco de verdade**

```bash
pnpm dev
```

Em outro terminal, abrir `http://localhost:3000/nerd-colecionaveis` (o único vendedor com slug no banco de dev) e conferir:

1. O hero mostra o nome, o total de itens e "membro desde setembro de 2026".
2. A grade tem 1 card (o banco tem 1 item ativo desse vendedor).
3. O card mostra o lance atual (R$ 24.000) e não o inicial.
4. Clicar em "Maior lance" muda a URL para `/nerd-colecionaveis?ordenar=lance` e a grade se mantém.
5. Buscar "zzz" mostra o estado vazio com "Limpar busca" e o `href="/nerd-colecionaveis"`.
6. **F12 → console: nenhum aviso.** Em especial, nenhum `Base UI: A component that acts as a button…` (o defeito que o `colunas.tsx` teve no dashboard).
7. Buscar "teste" devolve o item — o `q` casa com o título e com o rótulo de tipo.
8. Num leitor de tela, o prazo do card é anunciado em `America/Sao_Paulo` (a Task 1).

- [ ] **Step 4: Verificar o `q` casa com o RÓTULO, não com o enum**

```bash
node -e "
const {Client}=require('pg');const fs=require('fs');
const url=fs.readFileSync('.env','utf8').match(/^DATABASE_URL=(.*)\$/m)[1];
(async()=>{const c=new Client({connectionString:url});await c.connect();
const i=await c.query(\"select id,type from items where status='active' limit 1\");
const t=i.rows[0].type;
const rot={product:'Produto',service:'Serviço',piece:'Peça colecionável'}[t];
const r=await c.query(\"select count(*)::int n from items where lower(title) like \$1 or lower(\$2) like \$1\",['%'+rot.toLowerCase()+'%',rot]);
console.log('tipo',t,'-> busca por',rot,'=>',r.rows[0].n,'itens');
await c.end();})();"
```

Expected: `n > 0` para o rótulo do tipo — é o `CASE` de rótulos que a Task do dashboard introduziu, e a vitrine depende dele.

- [ ] **Step 5: Conferir que nada protection foi violado**

```bash
git diff 27ec2e8 --stat -- "*.test.ts" "*.test.tsx" | tail -20
```

Expected: **apenas** `skeletons.test.tsx` e `page.test.tsx` aparecem. Qualquer outro `.test` neste diff é uma violação do "562 protegidos".

- [ ] **Step 6: Limpar o `.git/gc.log` que vem avisando desde o commit anterior**

```bash
[ -f .git/gc.log ] && cat .git/gc.log && rm -f .git/gc.log && git prune || echo "sem gc.log"
```

- [ ] **Step 7: Commit final**

```bash
git add -A && git commit -m "chore: verificacao final da vitrine de conversao" || echo "nada a commitar"
```

---

## Self-Review

**1. Cobertura da spec:** § 2 (todos os 8 itens incluídos → Tasks 2–10) ✓; § 3 (IHC: visibility → Task 5 badge + countdown; match with real world → Tasks 1, 5, 8; user control → Tasks 2, 9; consistency → Global Constraints; recognition → Task 5; minimalist → Task 8 sem selo falso; error prevention → Task 2; error recovery → Task 10; Von Restorff → Task 5) ✓; § 3.1 (badge 24h) → Task 5 ✓; § 4.1 (árvore) → File Structure ✓; § 4.2 → Task 2 ✓; § 4.3 → Task 5 ✓; § 4.4 → Task 8 ✓; § 4.5 (fluxo) → Task 10 ✓; § 5.1 → Task 4 ✓; § 5.2 (ordenar em JS) → Task 4 ✓; § 5.3 (porta) → Task 3 ✓; § 5.4 (use case novo) → Task 4 ✓; § 5.5 (null por último) → Task 4 ✓; § 5.6 (`lance`) → Task 2 ✓; § 6.2 (bug fuso) → Task 1 ✓; § 7 (error handling, 8 linhas) → Tasks 2, 4, 10 ✓; § 8 (testes, 7 arquivos) → Tasks 1–8, 10 ✓; § 9 (fora de escopo) → respeitado ✓; § 10 (riscos) → mitigados nas tasks ✓.

**Desvios da spec encontrados e corrigidos durante o planejamento** (a spec errava em três pontos; a decisão real veio da evidência do código e do banco):

| Spec dizia | Reality check | Onde está registrado |
|---|---|---|
| `vitrine-skeleton.tsx` como arquivo NOVO | `ItemCardSkeleton` já existe, é testado por `skeletons.test.tsx`, e `page.test.tsx:174` depende do `data-slot`. Criar um novo quebraria um teste sem ganho. | Task 6 modifica o existente |
| `public-item-card.test.ts` existente precisa ser aprovado para reescrita | **Esse arquivo não existe.** Não há tensão ali. | Removido da lista de Protected Tests |
| Hero mostra avatar + "N itens em leilão" + "Membro desde" | `findBySlug` devolve só `{id, name, slug}`. Estendê-lo quebra 9 fakes + `get-seller-by-slug.test.ts:32`. → porta nova `VitrineDeVendedorRepository` | Task 7 |
| Tensão de protected test não mencionada | `page.test.tsx:178` (`toHaveBeenCalledWith("u1")`) **precisa** mudar porque a action passa a receber a vista | Protected Tests, Task 10 Step 3 |
| "ordenação em JS" sem medir | Medido: a vitrine já carrega o conjunto inteiro (sem paginação) e o `max(amount)` é index-only pelo índice `(item_id, amount DESC)` da migração 0004 | Task 4 nota `ponytail:` |

**2. Placeholder scan:** nenhum TBD/TODO. Todo passo de código tem o código. Nenhum "similar à Task N".

**3. Type consistency:**
- `EstatisticasDeLance` / `EstatisticasDeLances.deVariosItens` — definido Task 3, consumido Tasks 4, 7 (não), 9. ✓
- `ItemDaVitrine` (8 chaves) — definido Task 4 Step 3, consumido Tasks 5, 9, 10. O teste de Task 4 exige exatamente as 8 chaves em ordem alfabética: `bidDeadline, id, imageUrl, maiorLance, minInitialBid, title, totalDeLances, type`. ✓
- `VistaDaVitrine` / `interpretarVitrine` / `hrefDaVista(slug, vista)` — Task 2, consumido Tasks 4, 9, 10. Assinatura de `hrefDaVista` com `slug` primeiro, usada igual nos três. ✓
- `listVitrine(itemRepo, lancesRepo, sellerId, vista)` — Task 4 Step 4, consumido Task 9 Step 3 com `drizzleItemRepository, drizzleEstatisticasDeLances`. ✓
- `PublicItemCard({ item, slug })` — Task 5, consumido Task 10. Note que `imageUrl` **saiu** das props (vem no DTO); o Task 5 Step 3 só passa `item` e `slug`. ✓
- `VitrineHero({ vendedor })` — Task 8, consumido Task 10. ✓
- `ControlesDaVitrine({ slug, vista })` — Task 9, consumido Task 10. ✓
- `JANELA_DE_URGENCIA_EM_HORAS` — Task 5, exportado e testado lá. ✓
- `page.tsx` usa `PageProps<"/[slug]">` **com** `searchParams` — o tipo gerado do Next 16 inclui `searchParams`; a Task 10 Step 4 o dessestructura. O `page.test.tsx` já passava `searchParams` em `props()`. ✓
- `EmptyState` aceita `action?: EmptyStateAction` e `icon?: ReactNode` e `description?: string` — Task 10 Step 4 usa os quatro, todos opcionais exceto `title`. ✓
- `Badge` aceita `variant: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"` — Task 5 usa `destructive` e `default`. ✓
- `Input` de `@/components/ui/input` — existe (confirmado no inventário de `src/components/ui/`). ✓

**Interrompendo para pedir aprovação explícita dos dois Protected Tests antes de executar** (o usuário já aprovou ambos na conversa, e estão registrados na seção "Protected Tests" deste plano).
