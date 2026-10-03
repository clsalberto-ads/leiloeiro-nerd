import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { STATUS_LABELS, TYPE_LABELS } from "@/domain/repositories/item-repository";
import { drizzleItemRepository } from "./drizzle-item-repository";

type DbCall = { metodo: string; args: unknown[] };
type DbQuery = { selectArgs: unknown[]; calls: DbCall[] };

// ponytail: o `db` e um encadeamento de metodos que se devolvem a si mesmo e so
// resolve quando alguem faz `then` — e o suficiente para as duas consultas que a
// listagem faz (`select().from().where().orderBy().limit().offset()` e
// `select({n}).from().where()`). O que este teste segura NAO e o SQL que sai
// daqui: e o objeto `where` que as DUAS consultas recebem, e a contagem que
// volta. Ver "o total e do conjunto filtrado" no relatorio.
const banco = vi.hoisted(() => ({
  consultas: [] as { selectArgs: unknown[]; calls: DbCall[] }[],
  linhas: [] as unknown[],
  contagem: 0,
}));

vi.mock("@/infrastructure/database/drizzle", () => {
  function montarDbQuery(selectArgs: unknown[], result: unknown) {
    const calls: DbCall[] = [];
    const corrente: Record<string, unknown> = {};
    for (const metodo of ["from", "where", "orderBy", "limit", "offset"]) {
      corrente[metodo] = (...args: unknown[]) => {
        calls.push({ metodo, args });
        return corrente;
      };
    }
    corrente.then = (aoResolver: (value: unknown) => void) => {
      aoResolver(result);
      return corrente;
    };
    banco.consultas.push({ selectArgs, calls });
    return corrente;
  }
  return {
    db: {
      select: (...selectArgs: unknown[]) =>
        selectArgs.length === 0
          ? montarDbQuery(selectArgs, banco.linhas)
          : montarDbQuery(selectArgs, [{ n: banco.contagem }]),
    },
  };
});

const ROW = {
  id: "i1",
  sellerId: "u1",
  title: "Console raro de 1989",
  description: "descricao",
  type: "product",
  imageUrl: null,
  minInitialBid: 1000,
  minBidIncrement: 100,
  bidDeadline: new Date("2026-03-01T00:00:00Z"),
  paymentDeadlineDays: 3,
  status: "draft",
  createdAt: new Date("2026-01-03T00:00:00Z"),
  updatedAt: new Date("2026-01-03T00:00:00Z"),
};

const dialeto = new PgDialect();

function consultas(): DbQuery[] {
  return banco.consultas;
}

function rowsQuery(): DbQuery {
  const achada = banco.consultas.find((c) => c.selectArgs.length === 0);
  if (!achada) throw new Error("a query das linhas nao foi montada");
  return achada;
}

function countQuery(): DbQuery {
  const achada = banco.consultas.find((c) => c.selectArgs.length > 0);
  if (!achada) throw new Error("a query da contagem nao foi montada");
  return achada;
}

function argumento(query: DbQuery, metodo: string): unknown[] | undefined {
  return query.calls.find((call) => call.metodo === metodo)?.args;
}

// `orderBy(...)` chega como UM argumento que e a lista de expressoes, e o `where` como
// um argumento solo. Achatar os dois niveis e o que deixa as duasiformas usarem o mesmo
// leitor de SQL.
function expressions(query: DbQuery, metodo: string): SQL[] {
  const args = argumento(query, metodo) ?? [];
  return args.flatMap((arg) => (Array.isArray(arg) ? arg : [arg])) as SQL[];
}

function sqlOf(query: DbQuery, metodo: string): string {
  return expressions(query, metodo)
    .map((expressao) => dialeto.sqlToQuery(expressao).sql)
    .join(", ");
}

function paramsOf(query: DbQuery, metodo: string): unknown[] {
  return expressions(query, metodo).flatMap((expressao) => dialeto.sqlToQuery(expressao).params);
}

beforeEach(() => {
  banco.consultas = [];
  banco.linhas = [];
  banco.contagem = 0;
});

describe("drizzleItemRepository.listBySellerId", () => {
  it("monta duas consultas: as linhas e a contagem", async () => {
    await drizzleItemRepository.listBySellerId("u1");
    expect(consultas()).toHaveLength(2);
    expect(rowsQuery().calls.map((c) => c.metodo)).toEqual([
      "from",
      "where",
      "orderBy",
    ]);
  });

  it("o total e do conjunto filtrado: as duas consultas recebem o MESMO where", async () => {
    await drizzleItemRepository.listBySellerId("u1", { status: "draft", q: "raro", limit: 10 });
    const rowsWhere = expressions(rowsQuery(), "where");
    const countWhere = expressions(countQuery(), "where");
    expect(rowsWhere).toHaveLength(1);
    expect(countWhere[0]).toBe(rowsWhere[0]);
  });

  it("esse where leva o vendedor, o status e a busca textual", async () => {
    await drizzleItemRepository.listBySellerId("u1", { status: "draft", q: "raro" });
    const where = rowsQuery();
    const text = sqlOf(where, "where");
    const params = paramsOf(where, "where");
    expect(text).toContain('"items"."seller_id"');
    expect(text).toContain('"items"."status"');
    expect(text).toContain('"items"."title"');
    expect(params).toContain("u1");
    expect(params).toContain("draft");
    expect(params).toContain("raro");
  });

  it("com orderBy e sem direction, a coluna vem em asc", async () => {
    await drizzleItemRepository.listBySellerId("u1", { orderBy: "title" });
    expect(sqlOf(rowsQuery(), "orderBy")).toContain('"items"."title" asc');
  });

  it("sem q, o where nao tem predicado de busca", async () => {
    await drizzleItemRepository.listBySellerId("u1", { status: "draft" });
    const where = rowsQuery();
    expect(sqlOf(where, "where")).not.toContain("strpos");
    expect(paramsOf(where, "where")).not.toContain("raro");
  });

  it("a dobra e de TODOS os lados, e o lower vem ANTES do translate", async () => {
    await drizzleItemRepository.listBySellerId("u1", { q: "acao" });
    const where = rowsQuery();
    const text = sqlOf(where, "where");
    const params = paramsOf(where, "where");
    // `translate` roda antes de `lower` quando a ordem sai como `lower(translate(x))`,
    // e a tabela e so de minuscula: "AÇÃO" e "Óculos" (com acento e caixa alta) deixavam
    // de casar com "Ação" e "Óculos". Rodado no Postgres 17, na ordem errada esses tres
    // termos devolviam zero resultado. Este teste e o que impede a volta.
    expect(text).toContain("strpos(translate(lower(");
    expect(text).not.toContain("lower(translate(");
    expect(text).not.toContain("ilike");
    expect(text).not.toContain("like");
    // A tabela de dobra (minuscula acentuada -> sem acento) e um parametro de cada
    // `translate`, e cada `strpos` dobra os DOIS lados. Sao tres colunas (titulo,
    // rotulo de status, rotulo de tipo) e dois lados cada: seis. Sao seis, e nao
    // dois, porque o rotulo tambem precisa ser dobrado antes de comparar com o termo
    // — dobrar so o termo faria "leilao" nao achar "Em leilao".
    expect(params.filter((p) => p === "áàâãäéèêëíìîïóòôõöúùûüçñý")).toHaveLength(6);
  });

  it("q casa com o titulo E com os rotulos de status e de tipo", async () => {
    await drizzleItemRepository.listBySellerId("u1", { q: "leilao" });
    const where = rowsQuery();
    const text = sqlOf(where, "where");
    // O `CASE` e o que traduz o enum gravado no rotulo pt-BR que o usuario le. Sem
    // ele o SQL so conhece "active" e a busca volta a responder "nenhum item" para um
    // termo escrito exatamente como esta na tela — que foi o que a busca no cliente
    // acertava e o modo servidor perdeu.
    expect(text).toContain('"items"."title"');
    expect(text).toContain('"items"."status"');
    expect(text).toContain('"items"."type"');
    expect(text).toMatch(/case\s+"items"\."status"/);
    expect(text).toMatch(/case\s+"items"\."type"/);
    // tres `strpos`: um por coluna que o termo pode casar
    expect(text.match(/strpos\(/g)).toHaveLength(3);
  });

  it("os rotulos que o SQL casa sao os do vocabulario canonico, nao copias", async () => {
    await drizzleItemRepository.listBySellerId("u1", { q: "leilao" });
    const params = paramsOf(rowsQuery(), "where");
    // Os rotulos chegam como PARAMETRO, vindos de `STATUS_LABELS`/`TYPE_LABELS` do
    // dominio. E o que prova que o SQL nao tem uma copia do vocabulario: se um rotulo
    // mudasse so no mapa, o `tsc` continuaria verde e este teste pararia de passar —
    // a diferenca entre "o texto que o usuario le" e "o texto que o SQL casa" voltaria
    // sem erro visivel.
    for (const label of Object.values(STATUS_LABELS)) expect(params).toContain(label);
    for (const label of Object.values(TYPE_LABELS)) expect(params).toContain(label);
  });

  it("cada rotulo entra no CASE colado na chave do enum que o produz", async () => {
    await drizzleItemRepository.listBySellerId("u1", { q: "leilao" });
    const params = paramsOf(rowsQuery(), "where");
    // `when <periodKey> then <rotulo>` sao dois parametROS VIZINHOS, entao a posicao do
    // rotulo diz qual e a chave que o produz. E o que impede o `CASE` de trocar dois
    // rotulos de lugar (o `tsc` nao acusa: os dois lados continuam sendo `string`), e
    // o defeito apareceria como "Em leilao" devolvendo os itens de rascunho.
    for (const mapa of [STATUS_LABELS, TYPE_LABELS]) {
      for (const [key, label] of Object.entries(mapa)) {
        const posicao = params.indexOf(label);
        expect(posicao, `o rotulo ${label} nao virou parametro do CASE`).toBeGreaterThan(0);
        expect(params[posicao - 1], `a chave ${key} nao precede o rotulo ${label}`).toBe(key);
      }
    }
  });

  it("devolve items da query das linhas e total da contagem", async () => {
    banco.linhas = [ROW];
    banco.contagem = 7;
    const result = await drizzleItemRepository.listBySellerId("u1", { limit: 1 });
    expect(result.total).toBe(7);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: "i1", title: "Console raro de 1989", minInitialBid: 1000 });
    expect(result.items[0]?.createdAt).toEqual(ROW.createdAt);
  });

  it("devolve lista vazia e total zero quando a tabela nao tem o que o filtro pediu", async () => {
    const result = await drizzleItemRepository.listBySellerId("u1", { q: "teclado" });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  // ponytail: o mesmo "nada achado" com um termo que e um ROTULO. Sem este caso o
  // `q` que so conhece o titulo passa em tudo que involve rotulo: a query volta
  // vazia e o total zera, o que parece exatamente o comportamento certo e e o
  // defeito — o usuario le "Nenhum item encontrado." para "Em leilao" digitado na
  // tela onde dois itens estao com esse status.
  it("um rotulo que nao casa com nada tambem devolve lista vazia e total zero", async () => {
    const result = await drizzleItemRepository.listBySellerId("u1", { q: TYPE_LABELS.piece });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("aplica limit e offset quando informados", async () => {
    await drizzleItemRepository.listBySellerId("u1", { limit: 25, offset: 50 });
    expect(argumento(rowsQuery(), "limit")).toEqual([25]);
    expect(argumento(rowsQuery(), "offset")).toEqual([50]);
  });

  it("sem limit, nao fatia a query", async () => {
    await drizzleItemRepository.listBySellerId("u1");
    expect(argumento(rowsQuery(), "limit")).toBeUndefined();
    expect(argumento(rowsQuery(), "offset")).toBeUndefined();
  });

  it("sem orderBy, ordena por createdAt desc, como a listagem ja fazia", async () => {
    await drizzleItemRepository.listBySellerId("u1");
    const query = rowsQuery();
    expect(sqlOf(query, "orderBy")).toContain('"items"."created_at" desc');
    expect(sqlOf(query, "orderBy")).toContain('"items"."id" asc');
    expect(paramsOf(query, "orderBy")).toEqual([]);
  });

  it.each([
    ["title", "asc", '"items"."title" asc'],
    ["title", "desc", '"items"."title" desc'],
    ["minInitialBid", "asc", '"items"."min_initial_bid" asc'],
    ["minInitialBid", "desc", '"items"."min_initial_bid" desc'],
    ["bidDeadline", "asc", '"items"."bid_deadline" asc'],
    ["bidDeadline", "desc", '"items"."bid_deadline" desc'],
  ] as const)("ordena por %s %s", async (orderBy, direction, expected) => {
    await drizzleItemRepository.listBySellerId("u1", { orderBy, direction });
    const query = rowsQuery();
    expect(sqlOf(query, "orderBy")).toContain(expected);
    expect(sqlOf(query, "orderBy")).toContain('"items"."id" asc');
  });

  it("findBySellerId continua devolvendo o array inteiro, sem total e sem pagina", async () => {
    banco.linhas = [ROW];
    banco.contagem = 7;
    const items = await drizzleItemRepository.findBySellerId("u1", { status: "draft" });
    expect(Array.isArray(items)).toBe(true);
    expect(items).toHaveLength(1);
    expect(argumento(rowsQuery(), "limit")).toBeUndefined();
  });
});
