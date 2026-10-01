import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deInputDeData, diaLocalDe, inicioDoDiaLocal, paraInputDeData } from "./fuso";
import { itemSchema } from "./validators";

// ponytail: a mutacao de `process.env.TZ` neste arquivo NAO e enfeite — e o que
// torna o teste barato E verdadeiro ao mesmo tempo. Rodar a suite inteira duas
// vezes (uma por fuso) dobra o tempo de CI para provar duas linhas; mutar o fuso do
// processo dentro do teste prova o mesmo num unico run, porque o codigo sob teste
// le `FUSO` explicitamente e nunca o fuso padrao do `Intl`.
//
// O `fusoDoProcessoMuda` abaixo e o guard: sem ele, o teste passaria mesmo se a
// mutacao de TZ parasse de funcionar em uma versao nova do Node, e voltaria a
// nao provar nada. Medido aqui: com `TZ=UTC` o `getTimezoneOffset()` antigo
// devolvia "2026-10-01T02:59" e com `TZ=America/Sao_Paulo` devolvia
// "2026-09-30T23:59" — a mutacao pega, e e por isso que o codigo antigo,
// apesar de passar na maquina de desenvolvimento, nao passa aqui.
const FUSOS = ["UTC", "America/Sao_Paulo", "Asia/Tokyo", "America/Los_Angeles"] as const;
const TZ_ORIGINAL = process.env.TZ;

function fusoDoProcessoMuda(): boolean {
  const d = new Date("2026-10-01T02:59:00Z");
  const antes = d.getTimezoneOffset();
  process.env.TZ = "UTC";
  const emUtc = new Date("2026-10-01T02:59:00Z").getTimezoneOffset();
  process.env.TZ = "America/Sao_Paulo";
  const emBr = new Date("2026-10-01T02:59:00Z").getTimezoneOffset();
  return antes !== emUtc || emUtc !== emBr;
}

beforeAll(() => {
  if (!fusoDoProcessoMuda()) {
    throw new Error(
      "Este arquivo depende de mutar process.env.TZ em runtime, e neste runtime a mutacao nao pegou. " +
        "Sem o guard, todos os testes abaixo passariam sem provar nada.",
    );
  }
});

afterAll(() => {
  if (TZ_ORIGINAL === undefined) delete process.env.TZ;
  else process.env.TZ = TZ_ORIGINAL;
});

describe("o fuso do processo nao muda o resultado", () => {
  it.each(FUSOS)("em %s, o campo do datetime-local mostra a hora do produto", (tz) => {
    process.env.TZ = tz;
    // 30/09 23:59 em Sao Paulo = 01/10 02:59 UTC
    expect(paraInputDeData(new Date("2026-10-01T02:59:00Z"))).toBe("2026-09-30T23:59");
  });

  it.each(FUSOS)("em %s, o round-trip volta para o mesmo instante", (tz) => {
    process.env.TZ = tz;
    // ponytail: o round-trip exato. E o que impede o dano real — salvar QUALQUER
    // campo do item arrastava o prazo junto, porque o servidor lia a hora de
    // parede no fuso dele e gravava 3 h antes do prazo escolhido. Com o codigo
    // antigo este `it` falha em TZ=UTC e passa em Sao Paulo.
    const original = new Date("2026-10-01T02:59:00Z");
    expect(deInputDeData(paraInputDeData(original)).toISOString()).toBe(original.toISOString());
  });

  it.each(FUSOS)("em %s, meio-dia do produto nao vira meia-noite", (tz) => {
    process.env.TZ = tz;
    // 12:00 em Sao Paulo = 15:00 UTC. O `toISOString().slice(0,16)` antigo
    // devolveria "2026-09-30T15:00" e o input marcaria 15:00 para o vendedor.
    expect(paraInputDeData(new Date("2026-09-30T15:00:00Z"))).toBe("2026-09-30T12:00");
    expect(deInputDeData("2026-09-30T12:00").toISOString()).toBe("2026-09-30T15:00:00.000Z");
  });

  it.each(FUSOS)("em %s, meia-noite do produto nao vira 24h", (tz) => {
    process.env.TZ = tz;
    // Sem `hourCycle: "h23"` o `Intl` pode devolver "24" em meia-noite, e o
    // `datetime-local` receberia "2026-10-01T24:00", que o navegador rejeita.
    expect(paraInputDeData(new Date("2026-10-01T03:00:00Z"))).toBe("2026-10-01T00:00");
  });
});

describe("o dia local (a janela do grafico)", () => {
  // ponytail: 18h–21h BRT e a faixa em que `toISOString().slice(0,10)` discorda
  // do fuso do produto. Foi nela que o grafico rotulava o ultimo ponto com a data
  // de AMANHA. Sao 19:00 BRT de 30/09 = 01:00 UTC de 01/10.
  it("as 19h BRT, o dia de hoje ainda e hoje", () => {
    expect(diaLocalDe(new Date("2026-10-01T01:00:00Z"))).toBe("2026-09-30");
  });

  it("as 21h BRT (limite), o dia ainda e hoje", () => {
    // 21:00 BRT de 30/09 = 00:00 UTC de 01/10
    expect(diaLocalDe(new Date("2026-10-01T00:00:00Z"))).toBe("2026-09-30");
  });

  it("a 00h BRT do dia seguinte, o dia ja virou", () => {
    // 00:00 BRT de 01/10 = 03:00 UTC de 01/10
    expect(diaLocalDe(new Date("2026-10-01T03:00:00Z"))).toBe("2026-10-01");
  });

  it("a meia-noite do dia local e a primeira hora do dia, em UTC", () => {
    // 00:00 BRT de 30/09 = 03:00 UTC de 30/09. A janela do grafico COMECA aqui;
    // com o `setUTCHours(0,0,0,0)` antigo ela comecava as 00:00 UTC = 21:00 de
    // BRT do dia anterior, e o lance das 00h30 ficava fora.
    const inicio = inicioDoDiaLocal(0, new Date("2026-10-01T01:00:00Z"));
    expect(inicio.toISOString()).toBe("2026-09-30T03:00:00.000Z");
    expect(diaLocalDe(inicio)).toBe("2026-09-30");
  });

  it("voltar 1 dia atravessa a virada de mes", () => {
    const base = new Date("2026-10-01T12:00:00Z");
    expect(diaLocalDe(inicioDoDiaLocal(0, base))).toBe("2026-10-01");
    expect(diaLocalDe(inicioDoDiaLocal(1, base))).toBe("2026-09-30");
    expect(diaLocalDe(inicioDoDiaLocal(30, base))).toBe("2026-09-01");
  });

  it("a janela de 30 dias tem 30 dias distintos e termina no dia de hoje", () => {
    const base = new Date("2026-10-01T12:00:00Z");
    const dias = Array.from({ length: 30 }, (_, i) => diaLocalDe(inicioDoDiaLocal(29 - i, base)));
    expect(new Set(dias).size, "a janela repetiu um dia").toBe(30);
    expect(dias[29]).toBe("2026-10-01");
  });

  it("as chaves do JS sao as mesmas que o SQL agrupa (o grafico e a lista concordam)", () => {
    // ponytail: o SQL agrupa com `date_trunc('day', created_at at time zone 'FUSO')`,
    // que devolve o dia como `timestamp SEM fuso` — o valor literal "2026-09-30
    // 00:00:00". Lido em UTC, esse valor da "2026-09-30", que e a MESMA chave que
    // `diaLocalDe` produz. Este `it` amarra as duas pontas: se um dia virar a
    // aritmetica do grafico para UTC, o ultimo ponto deixa de casar com a coluna
    // do `GROUP BY` e o dia some da linha sem erro nenhum.
    for (const instante of ["2026-10-01T01:00:00Z", "2026-10-01T03:00:00Z", "2026-10-01T12:00:00Z", "2026-02-28T02:00:00Z"]) {
      const diaDoProduto = diaLocalDe(new Date(instante));
      // o que o Postgres manda de volta: `timestamp SEM fuso` com o dia literal
      const comoVoltaDoSql = new Date(`${diaDoProduto} 00:00:00`).toISOString().slice(0, 10);
      expect(comoVoltaDoSql, `instante ${instante}: JS e SQL discordam sobre o dia`).toBe(diaDoProduto);
    }
  });
});

describe("uma string com fuso explicito manda", () => {
  it("ISO com Z nao muda de significado", () => {
    // Os testes e qualquer cliente de API mandam ISO completo. Tratar isso como
    // hora de parede moveria todo mundo 3 h; o designator e o que torna a string
    // inequivoca, entao ela vai direto pro `Date`.
    expect(deInputDeData("2026-10-01T02:59:00.000Z").toISOString()).toBe("2026-10-01T02:59:00.000Z");
    expect(deInputDeData("2026-10-01T02:59:00+00:00").toISOString()).toBe("2026-10-01T02:59:00.000Z");
  });

  it("uma string invalida vira Invalid Date, e nao uma data inventada", () => {
    expect(Number.isNaN(deInputDeData("nao-e-data").getTime())).toBe(true);
    expect(Number.isNaN(deInputDeData("").getTime())).toBe(true);
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
  // 2030-09-30 23:59 no fuso do produto. O `Date.now() + n` dos outros testes
  // serviria, mas deixa a conta do fuso invisivel — aqui o numero e o que faz a
  // assercao valer.
  const parede = "2030-09-30T23:59";

  it("uma hora de parede do produto vira o instante correspondente", () => {
    const r = itemSchema.safeParse({ ...base, bidDeadline: parede });
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    if (r.success) expect((r.data.bidDeadline as Date).toISOString()).toBe("2030-10-01T02:59:00.000Z");
  });

  it("o mesmo campo aceito como Date continua aceito", () => {
    const r = itemSchema.safeParse({ ...base, bidDeadline: new Date("2030-10-01T02:59:00Z") });
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it("o round-trip completo form -> action -> form devolve o prazo original", () => {
    // ponytail: este e o teste do dano real, e une as duas pontas. O `item-form`
    // escreve o valor do input (via `paraInputDeData`) e a action o le (via
    // `itemSchema` -> `deInputDeData`). Se um dos dois voltar a usar o fuso do
    // processo, este `it` quebra em TZ=UTC mesmo passando em Sao Paulo.
    const noBanco = new Date("2030-10-01T02:59:00Z");
    const r = itemSchema.safeParse({ ...base, bidDeadline: paraInputDeData(noBanco) });
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    if (r.success) expect((r.data.bidDeadline as Date).toISOString()).toBe(noBanco.toISOString());
  });

  it("continua recusando prazo no passado, com a hora de parede do produto", () => {
    const r = itemSchema.safeParse({ ...base, bidDeadline: "2020-01-01T10:00" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("Prazo de lances deve ser no futuro");
  });

  it("continua recusando data invalida com a mensagem de sempre", () => {
    const r = itemSchema.safeParse({ ...base, bidDeadline: "lixo" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("Prazo de lances inválido");
  });
});

describe("FUSO continua sendo a fonte unica", () => {
  it("nao ha segundo literal de fuso em src/", async () => {
    // ponytail: o valor do fuso esta escrito em `FUSO` e so pode estar la. Um
    // segundo literal colado em outro arquivo faria os dois lados divergirem de
    // novo, que e o modo de falha que estes dois conversores acabaram de
    // eliminar. Este teste falha no instante em que alguem colar.
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const achados: string[] = [];
    const andar = (dir: string) => {
      for (const entrada of readdirSync(dir)) {
        const caminho = join(dir, entrada);
        if (statSync(caminho).isDirectory()) andar(caminho);
        else if (
          /\.tsx?$/.test(caminho) &&
          !caminho.includes(".test.") &&
          caminho !== join("src", "lib", "fuso.ts")
        ) {
          readFileSync(caminho, "utf8")
            .split("\n")
            .forEach((linha, i) => {
              // ignora comentarios: o ponytail de fuso.ts cita o fuso de proposito
              const semComentario = linha.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
              if (semComentario.includes("America/Sao_Paulo")) achados.push(`${caminho}:${i + 1}`);
            });
        }
      }
    };
    andar("src");
    expect(achados, `fuso duplicado fora de fuso.ts: ${achados.join(", ")}`).toEqual([]);
  });
});
