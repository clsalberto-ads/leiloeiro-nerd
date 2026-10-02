import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fromInputDateString, localDateOf, startOfLocalDay, toInputDateString } from "./timezone";
import { itemSchema } from "./validators";

// ponytail: a mutacao de `process.env.TZ` neste arquivo NAO e enfeite — e o que
// torna o teste barato E verdadeiro ao mesmo tempo. Rodar a suite inteira duas
// vezes (uma por fuso) dobra o tempo de CI para provar duas linhas; mutar o fuso do
// processo dentro do teste prova o mesmo num unico run, porque o codigo sob teste
// le `APP_TIMEZONE` explicitamente e nunca o fuso padrao do `Intl`.
//
// O `processTzChanges` abaixo e o guard: sem ele, o teste passaria mesmo se a
// mutacao de TZ parasse de funcionar em uma versao nova do Node, e voltaria a
// nao provar nada. Medido aqui: com `TZ=UTC` o `new Date(string)`/`toISOString()` antigo
// devolvia "2026-10-01T02:59" e com `TZ=America/Sao_Paulo` devolvia
// "2026-09-30T23:59" — a mutacao pega, e e por isso que o codigo antigo,
// apesar de passar na maquina de desenvolvimento, nao passa aqui.
const TIMEZONES = ["UTC", "America/Sao_Paulo", "Asia/Tokyo", "America/Los_Angeles"] as const;
const TZ_ORIGINAL = process.env.TZ;

function processTzChanges(): boolean {
  const d = new Date("2026-10-01T02:59:00Z");
  const before = d.getTimezoneOffset();
  process.env.TZ = "UTC";
  const inUtc = new Date("2026-10-01T02:59:00Z").getTimezoneOffset();
  process.env.TZ = "America/Sao_Paulo";
  const inBr = new Date("2026-10-01T02:59:00Z").getTimezoneOffset();
  return before !== inUtc || inUtc !== inBr;
}

beforeAll(() => {
  if (!processTzChanges()) {
    throw new Error(
      "This file depends on mutating process.env.TZ at runtime, and in this runtime the mutation didn't catch. " +
        "Without the guard, all tests below would pass without proving anything.",
    );
  }
});

afterAll(() => {
  if (TZ_ORIGINAL === undefined) delete process.env.TZ;
  else process.env.TZ = TZ_ORIGINAL;
});

describe("o fuso do processo nao muda o resultado", () => {
  it.each(TIMEZONES)("in %s, datetime-local field shows product wall time", (tz) => {
    process.env.TZ = tz;
    // 30/09 23:59 em Sao Paulo = 01/10 02:59 UTC
    expect(toInputDateString(new Date("2026-10-01T02:59:00Z"))).toBe("2026-09-30T23:59");
  });

  it.each(TIMEZONES)("in %s, round-trip returns the same instant", (tz) => {
    process.env.TZ = tz;
    // ponytail: ida-e-volta exato. E isto que evita o dano real — salvar
    // QUALQUER campo do item arrastava o prazo junto, porque o servidor lia a
    // hora de relogio no fuso dele e gravava 3 h antes do prazo escolhido. Com o
    // codigo antigo este `it` falha em TZ=UTC e passa em Sao Paulo.
    const original = new Date("2026-10-01T02:59:00Z");
    expect(fromInputDateString(toInputDateString(original)).toISOString()).toBe(original.toISOString());
  });

  it.each(TIMEZONES)("in %s, product noon doesn't become midnight", (tz) => {
    process.env.TZ = tz;
    // 12:00 em Sao Paulo = 15:00 UTC. O `toISOString().slice(0,16)` antigo
    // devolveria "2026-09-30T15:00" e o input mostraria 15:00 ao vendedor.
    expect(toInputDateString(new Date("2026-09-30T15:00:00Z"))).toBe("2026-09-30T12:00");
    expect(fromInputDateString("2026-09-30T12:00").toISOString()).toBe("2026-09-30T15:00:00.000Z");
  });

  it.each(TIMEZONES)("in %s, product midnight doesn't become 24h", (tz) => {
    process.env.TZ = tz;
    // Sem `hourCycle: "h23"` o `Intl` pode devolver "24" na meia-noite, e o
    // `datetime-local` receberia "2026-10-01T24:00", que o navegador rejeita.
    expect(toInputDateString(new Date("2026-10-01T03:00:00Z"))).toBe("2026-10-01T00:00");
  });
});

describe("o dia local (a janela do grafico)", () => {
  // ponytail: a faixa de 18h–21h BRT e onde `localDateOf` discorda
  // do fuso do produto. Era aqui que o grafico rotulava o ultimo ponto com a data
  // de AMANHA. 19:00 BRT em 30/09 = 01:00 UTC em 01/10.
  it("as 19h BRT, hoje ainda e hoje", () => {
    expect(localDateOf(new Date("2026-10-01T01:00:00Z"))).toBe("2026-09-30");
  });

  it("as 21h BRT (limite), o dia ainda e hoje", () => {
    // 21:00 BRT em 30/09 = 00:00 UTC em 01/10
    expect(localDateOf(new Date("2026-10-01T00:00:00Z"))).toBe("2026-09-30");
  });

  it("as 00h BRT do dia seguinte, o dia ja virou", () => {
    // 00:00 BRT em 01/10 = 03:00 UTC em 01/10
    expect(localDateOf(new Date("2026-10-01T03:00:00Z"))).toBe("2026-10-01");
  });

  it("a meia-noite do produto e a primeira hora do dia, em UTC", () => {
    // 00:00 BRT em 30/09 = 03:00 UTC em 30/09. A janela do grafico COMECA aqui;
    // com o antigo `setUTCHours(0,0,0,0)` ela comecava em 00:00 UTC = 21:00 BRT
    // do dia anterior, e o lance das 00:30 ficava de fora.
    const start = startOfLocalDay(0, new Date("2026-10-01T01:00:00Z"));
    expect(start.toISOString()).toBe("2026-09-30T03:00:00.000Z");
    expect(localDateOf(start)).toBe("2026-09-30");
  });

  it("voltar 1 dia atravessa a fronteira de mes", () => {
    const base = new Date("2026-10-01T12:00:00Z");
    expect(localDateOf(startOfLocalDay(0, base))).toBe("2026-10-01");
    expect(localDateOf(startOfLocalDay(1, base))).toBe("2026-09-30");
    expect(localDateOf(startOfLocalDay(30, base))).toBe("2026-09-01");
  });

  it("a janela de 30 dias tem 30 dias distintos e termina hoje", () => {
    const base = new Date("2026-10-01T12:00:00Z");
    const days = Array.from({ length: 30 }, (_, i) => localDateOf(startOfLocalDay(29 - i, base)));
    expect(new Set(days).size, "window repeated a day").toBe(30);
    expect(days[29]).toBe("2026-10-01");
  });

  it("as chaves do JS batem com o que o SQL agrupa (grafico e listagem concordam)", () => {
    // ponytail: o SQL agrupa com `date_trunc('day', created_at at time zone 'APP_TIMEZONE')`,
    // que devolve o dia como `timestamp SEM fuso` — o valor literal
    // "2026-09-30 00:00:00". Lido em UTC, esse valor da "2026-09-30", que e a MESMA
    // chave que `localDateOf` produz. Este `it` amarra as duas pontas: se alguem
    // algum dia mudar a aritmetica do grafico para UTC, o ultimo ponto deixa de
    // bater com a coluna do `GROUP BY` e o dia desaparece da row sem nenhum erro.
    for (const instant of ["2026-10-01T01:00:00Z", "2026-10-01T03:00:00Z", "2026-10-01T12:00:00Z", "2026-02-28T02:00:00Z"]) {
      const productDay = localDateOf(new Date(instant));
      // o que o Postgres devolve: `timestamp SEM fuso` com o dia literal
      const asReturnedFromSql = new Date(`${productDay} 00:00:00`).toISOString().slice(0, 10);
      expect(asReturnedFromSql, `instant ${instant}: JS and SQL disagree on the day`).toBe(productDay);
    }
  });
});

describe("uma string com zona explicita vence", () => {
  it("ISO com Z nao muda de significado", () => {
    // Os testes e qualquer cliente de API enviam ISO completa. Tratar isso como
    // hora de relogio deslocaria todo mundo em 3 h; o designador torna a string
    // inequivoca, entao ela vai direto para `new Date`.
    expect(fromInputDateString("2026-10-01T02:59:00.000Z").toISOString()).toBe("2026-10-01T02:59:00.000Z");
    expect(fromInputDateString("2026-10-01T02:59:00+00:00").toISOString()).toBe("2026-10-01T02:59:00.000Z");
  });

  it("uma string invalida vira Invalid Date, e nao uma data inventada", () => {
    expect(Number.isNaN(fromInputDateString("not-a-date").getTime())).toBe(true);
    expect(Number.isNaN(fromInputDateString("").getTime())).toBe(true);
  });
});

describe("itemSchema le o prazo no fuso do produto", () => {
  const base = {
    title: "Um titulo qualquer",
    description: "Uma descricao com pelo menos dez caracteres",
    type: "product" as const,
    minInitialBid: "10",
    minBidIncrement: "5",
  };
  // 2030-09-30 23:59 no fuso do produto. `Date.now() + n` de outros testes
  // funcionaria, mas esconde a conta do fuso — aqui o numero faz a asercao valer.
  const wall = "2030-09-30T23:59";

  it("uma hora de relogio do produto vira o instante correspondente", () => {
    const r = itemSchema.safeParse({ ...base, bidDeadline: wall });
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    if (r.success) expect((r.data.bidDeadline as Date).toISOString()).toBe("2030-10-01T02:59:00.000Z");
  });

  it("o mesmo campo aceito como Date ainda passa", () => {
    const r = itemSchema.safeParse({ ...base, bidDeadline: new Date("2030-10-01T02:59:00Z") });
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it("o ida-e-volta completo form -> action -> form devolve o prazo original", () => {
    // ponytail: este e o teste do dano real, e amarra as duas pontas. O
    // `item-form` escreve o value do input (via `toInputDateString`) e a action
    // le (via `itemSchema` -> `fromInputDateString`). Se qualquer um dos dois
    // voltar a usar o fuso do processo, este `it` quebra em TZ=UTC e passa em
    // Sao Paulo.
    const inDb = new Date("2030-10-01T02:59:00Z");
    const r = itemSchema.safeParse({ ...base, bidDeadline: toInputDateString(inDb) });
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    if (r.success) expect((r.data.bidDeadline as Date).toISOString()).toBe(inDb.toISOString());
  });

  it("ainda rejeita prazo vencido, com hora de relogio do produto", () => {
    const r = itemSchema.safeParse({ ...base, bidDeadline: "2020-01-01T10:00" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("Prazo de lances deve ser no futuro");
  });

  it("ainda rejeita data invalida com a mensagem de sempre", () => {
    const r = itemSchema.safeParse({ ...base, bidDeadline: "lixo" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("Prazo de lances inválido");
  });
});

describe("APP_TIMEZONE continua sendo a fonte unica de verdade", () => {
  it("nenhum segundo literal de fuso em src/", async () => {
    // ponytail: o valor do fuso esta escrito em `APP_TIMEZONE` e so pode estar
    // la. Um segundo literal colado em outro arquivo faria as duas pontas
    // divergirem de novo, que e justamente o modo de falha que estes dois
    // conversores acabaram de eliminar. Este teste falha no instante em que
    // alguem cola um.
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (
          /\.tsx?$/.test(path) &&
          !path.includes(".test.") &&
          path !== join("src", "lib", "timezone.ts")
        ) {
          readFileSync(path, "utf8")
            .split("\n")
            .forEach((line, i) => {
              // ignora comentarios: o ponytail de timezone.ts cita o fuso de proposito
              const withoutComment = line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
              if (withoutComment.includes("America/Sao_Paulo")) found.push(`${path}:${i + 1}`);
            });
        }
      }
    };
    walk("src");
    expect(found, `duplicate tz outside timezone.ts: ${found.join(", ")}`).toEqual([]);
  });
});