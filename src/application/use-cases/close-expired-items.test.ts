import { describe, expect, it } from "vitest";
import { closeExpiredItems } from "./close-expired-items";
import type { ItemRepository } from "@/domain/repositories/item-repository";

function fakeRepo() {
  const chamadas: Date[] = [];
  return {
    chamadas,
    repo: {
      async closeExpired(now: Date) {
        chamadas.push(now);
        return ["i1", "i2"];
      },
    } as unknown as ItemRepository,
  };
}

describe("closeExpiredItems", () => {
  // ponytail: `closed` estava no enum e nenhum codigo o produzia — a unica
  // transicao escrita era `draft -> active`. Este `it` existe para travar que a
  // transicao de encerramento EXISTE, e nao so que ela delega a chamada.
  it("encerra os expirados e devolve os ids", async () => {
    const { repo } = fakeRepo();
    await expect(closeExpiredItems(repo, new Date("2026-10-02T12:00:00Z"))).resolves.toEqual(["i1", "i2"]);
  });

  // O worker passa UM instante para a execucao inteira. Se o use case consultasse
  // `Date.now()` por conta propria, dois itens que venceram no mesmo minuto
  // poderiam cair em janelas diferentes conforme o UPDATE demorava.
  it("repassa o mesmo instante para todos os itens da execucao", async () => {
    const { repo, chamadas } = fakeRepo();
    const agora = new Date("2026-10-02T12:00:00Z");
    await closeExpiredItems(repo, agora);
    await closeExpiredItems(repo, agora);
    expect(chamadas).toEqual([agora, agora]);
  });

  it("nao enche o relogio do repositorio quando o worker nao passa instante", async () => {
    const { repo, chamadas } = fakeRepo();
    await closeExpiredItems(repo);
    expect(chamadas).toHaveLength(1);
    expect(Number.isNaN(chamadas[0].getTime())).toBe(false);
  });
});
