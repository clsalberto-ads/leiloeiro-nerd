import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { ROTULO_STATUS, ROTULO_TIPO } from "@/domain/repositories/item-repository";
import { drizzleItemRepository } from "./drizzle-item-repository";

type Chamada = { metodo: string; args: unknown[] };
type Consulta = { argsDoSelect: unknown[]; chamadas: Chamada[] };

// ponytail: o `db` e um encadeamento de metodos que se devolvem a si mesmo e so
// resolve quando alguem faz `then` — e o suficiente para as duas consultas que a
// listagem faz (`select().from().where().orderBy().limit().offset()` e
// `select({n}).from().where()`). O que este teste segura NAO e o SQL que sai
// daqui: e o objeto `where` que as DUAS consultas recebem, e a contagem que
// volta. Ver "o total e do conjunto filtrado" no relatorio.
const banco = vi.hoisted(() => ({
  consultas: [] as { argsDoSelect: unknown[]; chamadas: Chamada[] }[],
  linhas: [] as unknown[],
  contagem: 0,
}));

vi.mock("@/infrastructure/database/drizzle", () => {
  function montarConsulta(argsDoSelect: unknown[], resultado: unknown) {
    const chamadas: Chamada[] = [];
    const corrente: Record<string, unknown> = {};
    for (const metodo of ["from", "where", "orderBy", "limit", "offset"]) {
      corrente[metodo] = (...args: unknown[]) => {
        chamadas.push({ metodo, args });
        return corrente;
      };
    }
    corrente.then = (aoResolver: (valor: unknown) => void) => {
      aoResolver(resultado);
      return corrente;
    };
    banco.consultas.push({ argsDoSelect, chamadas });
    return corrente;
  }
  return {
    db: {
      select: (...argsDoSelect: unknown[]) =>
        argsDoSelect.length === 0
          ? montarConsulta(argsDoSelect, banco.linhas)
          : montarConsulta(argsDoSelect, [{ n: banco.contagem }]),
    },
  };
});

const LINHA = {
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

function consultas(): Consulta[] {
  return banco.consultas;
}

function consultaDasLinhas(): Consulta {
  const achada = banco.consultas.find((c) => c.argsDoSelect.length === 0);
  if (!achada) throw new Error("a consulta das linhas nao foi montada");
  return achada;
}

function consultaDaContagem(): Consulta {
  const achada = banco.consultas.find((c) => c.argsDoSelect.length > 0);
  if (!achada) throw new Error("a consulta da contagem nao foi montada");
  return achada;
}

function argumento(consulta: Consulta, metodo: string): unknown[] | undefined {
  return consulta.chamadas.find((chamada) => chamada.metodo === metodo)?.args;
}

// `orderBy(...)` chega como UM argumento que e a lista de expressoes, e o `where` como
// um argumento solo. Achatar os dois niveis e o que deixa as duasiformas usarem o mesmo
// leitor de SQL.
function expressoes(consulta: Consulta, metodo: string): SQL[] {
  const args = argumento(consulta, metodo) ?? [];
  return args.flatMap((arg) => (Array.isArray(arg) ? arg : [arg])) as SQL[];
}

function sqlDe(consulta: Consulta, metodo: string): string {
  return expressoes(consulta, metodo)
    .map((expressao) => dialeto.sqlToQuery(expressao).sql)
    .join(", ");
}

function paramsDe(consulta: Consulta, metodo: string): unknown[] {
  return expressoes(consulta, metodo).flatMap((expressao) => dialeto.sqlToQuery(expressao).params);
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
    expect(consultaDasLinhas().chamadas.map((c) => c.metodo)).toEqual([
      "from",
      "where",
      "orderBy",
    ]);
  });

  it("o total e do conjunto filtrado: as duas consultas recebem o MESMO where", async () => {
    await drizzleItemRepository.listBySellerId("u1", { status: "draft", q: "raro", limit: 10 });
    const whereDasLinhas = expressoes(consultaDasLinhas(), "where");
    const whereDaContagem = expressoes(consultaDaContagem(), "where");
    expect(whereDasLinhas).toHaveLength(1);
    expect(whereDaContagem[0]).toBe(whereDasLinhas[0]);
  });

  it("esse where leva o vendedor, o status e a busca textual", async () => {
    await drizzleItemRepository.listBySellerId("u1", { status: "draft", q: "raro" });
    const where = consultaDasLinhas();
    const texto = sqlDe(where, "where");
    const params = paramsDe(where, "where");
    expect(texto).toContain('"items"."seller_id"');
    expect(texto).toContain('"items"."status"');
    expect(texto).toContain('"items"."title"');
    expect(params).toContain("u1");
    expect(params).toContain("draft");
    expect(params).toContain("raro");
  });

  it("com orderBy e sem direction, a coluna vem em asc", async () => {
    await drizzleItemRepository.listBySellerId("u1", { orderBy: "title" });
    expect(sqlDe(consultaDasLinhas(), "orderBy")).toContain('"items"."title" asc');
  });

  it("sem q, o where nao tem predicado de busca", async () => {
    await drizzleItemRepository.listBySellerId("u1", { status: "draft" });
    const where = consultaDasLinhas();
    expect(sqlDe(where, "where")).not.toContain("strpos");
    expect(paramsDe(where, "where")).not.toContain("raro");
  });

  it("a dobra e de TODOS os lados, e o lower vem ANTES do translate", async () => {
    await drizzleItemRepository.listBySellerId("u1", { q: "acao" });
    const where = consultaDasLinhas();
    const texto = sqlDe(where, "where");
    const params = paramsDe(where, "where");
    // `translate` roda antes de `lower` quando a ordem sai como `lower(translate(x))`,
    // e a tabela e so de minuscula: "AÇÃO" e "Óculos" (com acento e caixa alta) deixavam
    // de casar com "Ação" e "Óculos". Rodado no Postgres 17, na ordem errada esses tres
    // termos devolviam zero resultado. Este teste e o que impede a volta.
    expect(texto).toContain("strpos(translate(lower(");
    expect(texto).not.toContain("lower(translate(");
    expect(texto).not.toContain("ilike");
    expect(texto).not.toContain("like");
    // A tabela de dobra (minuscula acentuada -> sem acento) e um parametro de cada
    // `translate`, e cada `strpos` dobra os DOIS lados. Sao tres colunas (titulo,
    // rotulo de status, rotulo de tipo) e dois lados cada: seis. Sao seis, e nao
    // dois, porque o rotulo tambem precisa ser dobrado antes de comparar com o termo
    // — dobrar so o termo faria "leilao" nao achar "Em leilao".
    expect(params.filter((p) => p === "áàâãäéèêëíìîïóòôõöúùûüçñý")).toHaveLength(6);
  });

  it("q casa com o titulo E com os rotulos de status e de tipo", async () => {
    await drizzleItemRepository.listBySellerId("u1", { q: "leilao" });
    const where = consultaDasLinhas();
    const texto = sqlDe(where, "where");
    // O `CASE` e o que traduz o enum gravado no rotulo pt-BR que o usuario le. Sem
    // ele o SQL so conhece "active" e a busca volta a responder "nenhum item" para um
    // termo escrito exatamente como esta na tela — que foi o que a busca no cliente
    // acertava e o modo servidor perdeu.
    expect(texto).toContain('"items"."title"');
    expect(texto).toContain('"items"."status"');
    expect(texto).toContain('"items"."type"');
    expect(texto).toMatch(/case\s+"items"\."status"/);
    expect(texto).toMatch(/case\s+"items"\."type"/);
    // tres `strpos`: um por coluna que o termo pode casar
    expect(texto.match(/strpos\(/g)).toHaveLength(3);
  });

  it("os rotulos que o SQL casa sao os do vocabulario canonico, nao copias", async () => {
    await drizzleItemRepository.listBySellerId("u1", { q: "leilao" });
    const params = paramsDe(consultaDasLinhas(), "where");
    // Os rotulos chegam como PARAMETRO, vindos de `ROTULO_STATUS`/`ROTULO_TIPO` do
    // dominio. E o que prova que o SQL nao tem uma copia do vocabulario: se um rotulo
    // mudasse so no mapa, o `tsc` continuaria verde e este teste pararia de passar —
    // a diferenca entre "o texto que o usuario le" e "o texto que o SQL casa" voltaria
    // sem erro visivel.
    for (const rotulo of Object.values(ROTULO_STATUS)) expect(params).toContain(rotulo);
    for (const rotulo of Object.values(ROTULO_TIPO)) expect(params).toContain(rotulo);
  });

  it("cada rotulo entra no CASE colado na chave do enum que o produz", async () => {
    await drizzleItemRepository.listBySellerId("u1", { q: "leilao" });
    const params = paramsDe(consultaDasLinhas(), "where");
    // `when <chave> then <rotulo>` sao dois parametROS VIZINHOS, entao a posicao do
    // rotulo diz qual e a chave que o produz. E o que impede o `CASE` de trocar dois
    // rotulos de lugar (o `tsc` nao acusa: os dois lados continuam sendo `string`), e
    // o defeito apareceria como "Em leilao" devolvendo os itens de rascunho.
    for (const mapa of [ROTULO_STATUS, ROTULO_TIPO]) {
      for (const [chave, rotulo] of Object.entries(mapa)) {
        const posicao = params.indexOf(rotulo);
        expect(posicao, `o rotulo ${rotulo} nao virou parametro do CASE`).toBeGreaterThan(0);
        expect(params[posicao - 1], `a chave ${chave} nao precede o rotulo ${rotulo}`).toBe(chave);
      }
    }
  });

  it("devolve items da consulta das linhas e total da contagem", async () => {
    banco.linhas = [LINHA];
    banco.contagem = 7;
    const resultado = await drizzleItemRepository.listBySellerId("u1", { limit: 1 });
    expect(resultado.total).toBe(7);
    expect(resultado.items).toHaveLength(1);
    expect(resultado.items[0]).toMatchObject({ id: "i1", title: "Console raro de 1989", minInitialBid: 1000 });
    expect(resultado.items[0]?.createdAt).toEqual(LINHA.createdAt);
  });

  it("devolve lista vazia e total zero quando a tabela nao tem o que o filtro pediu", async () => {
    const resultado = await drizzleItemRepository.listBySellerId("u1", { q: "teclado" });
    expect(resultado.items).toEqual([]);
    expect(resultado.total).toBe(0);
  });

  // ponytail: o mesmo "nada achado" com um termo que e um ROTULO. Sem este caso o
  // `q` que so conhece o titulo passa em tudo que involve rotulo: a consulta volta
  // vazia e o total zera, o que parece exatamente o comportamento certo e e o
  // defeito — o usuario le "Nenhum item encontrado." para "Em leilao" digitado na
  // tela onde dois itens estao com esse status.
  it("um rotulo que nao casa com nada tambem devolve lista vazia e total zero", async () => {
    const resultado = await drizzleItemRepository.listBySellerId("u1", { q: ROTULO_TIPO.piece });
    expect(resultado.items).toEqual([]);
    expect(resultado.total).toBe(0);
  });

  it("aplica limit e offset quando informados", async () => {
    await drizzleItemRepository.listBySellerId("u1", { limit: 25, offset: 50 });
    expect(argumento(consultaDasLinhas(), "limit")).toEqual([25]);
    expect(argumento(consultaDasLinhas(), "offset")).toEqual([50]);
  });

  it("sem limit, nao fatia a consulta", async () => {
    await drizzleItemRepository.listBySellerId("u1");
    expect(argumento(consultaDasLinhas(), "limit")).toBeUndefined();
    expect(argumento(consultaDasLinhas(), "offset")).toBeUndefined();
  });

  it("sem orderBy, ordena por createdAt desc, como a listagem ja fazia", async () => {
    await drizzleItemRepository.listBySellerId("u1");
    const consulta = consultaDasLinhas();
    expect(sqlDe(consulta, "orderBy")).toContain('"items"."created_at" desc');
    expect(sqlDe(consulta, "orderBy")).toContain('"items"."id" asc');
    expect(paramsDe(consulta, "orderBy")).toEqual([]);
  });

  it.each([
    ["title", "asc", '"items"."title" asc'],
    ["title", "desc", '"items"."title" desc'],
    ["minInitialBid", "asc", '"items"."min_initial_bid" asc'],
    ["minInitialBid", "desc", '"items"."min_initial_bid" desc'],
    ["bidDeadline", "asc", '"items"."bid_deadline" asc'],
    ["bidDeadline", "desc", '"items"."bid_deadline" desc'],
  ] as const)("ordena por %s %s", async (orderBy, direction, esperado) => {
    await drizzleItemRepository.listBySellerId("u1", { orderBy, direction });
    const consulta = consultaDasLinhas();
    expect(sqlDe(consulta, "orderBy")).toContain(esperado);
    expect(sqlDe(consulta, "orderBy")).toContain('"items"."id" asc');
  });

  it("findBySellerId continua devolvendo o array inteiro, sem total e sem pagina", async () => {
    banco.linhas = [LINHA];
    banco.contagem = 7;
    const itens = await drizzleItemRepository.findBySellerId("u1", { status: "draft" });
    expect(Array.isArray(itens)).toBe(true);
    expect(itens).toHaveLength(1);
    expect(argumento(consultaDasLinhas(), "limit")).toBeUndefined();
  });
});
