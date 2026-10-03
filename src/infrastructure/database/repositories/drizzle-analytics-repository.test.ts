import { afterEach, describe, expect, it } from "vitest";
import { asDayKey } from "./drizzle-analytics-repository";

// ponytail: o `Date` e montado com `new Date(ano, mes, dia, ...)` de proposito —
// e assim que o `pg-types` parseia um `timestamp SEM fuso`: ele pega os
// componentes que o Postgres mandou e os monta como hora LOCAL do processo. O
// agrupamento do SQL ja aplicou `at time zone 'America/Sao_Paulo'`, entao esses
// componentes JA sao a hora de parede de Sao Paulo.
function comoDriverDevolve(text: string): Date {
  const [date, time] = text.split(" ");
  const [ano, mes, dia] = date.split("-").map(Number);
  const [hora, minuto] = time.split(":").map(Number);
  return new Date(ano, mes - 1, dia, hora, minuto);
}

const TZ_ORIGINAL = process.env.TZ;

afterEach(() => {
  if (TZ_ORIGINAL === undefined) delete process.env.TZ;
  else process.env.TZ = TZ_ORIGINAL;
});

describe("asDayKey", () => {
  it("devolve o dia que o Postgres agrupou, e nao o dia UTC do mesmo instante", () => {
    // O SQL agrupou em `at time zone 'America/Sao_Paulo'`, entao a chave e
    // 02/10 — independentemente de onde o processo roda.
    expect(asDayKey(comoDriverDevolve("2026-10-02 21:30:00"))).toBe("2026-10-02");
  });

  // ponytail: este e o teste que pega a regressao. Em `America/Sao_Paulo`
  // (offset -03:00), uma hora de parede entre 21:00 e 23:59 cai NO DIA SEGUINTE
  // quando lida em UTC. A implementacao antiga usava `toISOString()`, que so
  // passava porque o servidor de nuvem roda em UTC — em qualquer maquina de
  // desenvolvimento no fuso do produto a chave do SQL deixava de casar com a
  // janela do grafico e o ponto aparecia como zero.
  it("nao troca de dia quando o processo roda em fuso com offset negativo", () => {
    process.env.TZ = "America/Sao_Paulo";
    const date = comoDriverDevolve("2026-10-02 21:30:00");

    // Sanidade: e este `Date` que realmente vira o dia seguinte em UTC, e o que
    // a leitura em componentes locais evita. Sem esta linha o teste passaria
    // mesmo com a implementacao errada.
    expect(date.toISOString().slice(0, 10)).toBe("2026-10-03");

    expect(asDayKey(date)).toBe("2026-10-02");
  });

  it("da o mesmo dia em qualquer fuso do processo", () => {
    for (const tz of ["UTC", "America/Sao_Paulo", "Asia/Tokyo", "Europe/Lisbon"]) {
      process.env.TZ = tz;
      expect(asDayKey(comoDriverDevolve("2026-10-02 04:15:00"))).toBe("2026-10-02");
      expect(asDayKey(comoDriverDevolve("2026-10-02 23:45:00"))).toBe("2026-10-02");
    }
  });

  it("aceita string, que e o outro tipo que o driver pode devolver", () => {
    process.env.TZ = "UTC";
    expect(asDayKey("2026-10-02T21:30:00.000Z")).toBe("2026-10-02");
  });

  it("rejeita o que nao e dia, em vez de virar NaN silencioso", () => {
    // Um `NaN` aqui viraria a chave "NaN-NaN-NaN" e o `map.get` do grafico
    // simplesmente nunca encontraria — o ponto sumiria sem erro nenhum.
    expect(() => asDayKey(42)).toThrow(/ilegível/);
    expect(() => asDayKey(new Date("nao-e-data"))).toThrow(/ilegível/);
  });
});
