import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRateLimited, resetRateLimits } from "./rate-limit";

// `Date.now` mockado: a janela deslizante é tempo, e o teste precisa de
// controle exato sobre ele em vez de `sleep`.
beforeEach(() => {
  vi.useFakeTimers();
  resetRateLimits();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isRateLimited", () => {
  it("aceita até o limite e recusa o excedente", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(isRateLimited("ip", 3, 60_000)).toBe(false);
    }
    expect(isRateLimited("ip", 3, 60_000)).toBe(true);
  });

  it("chaves diferentes têm janelas independentes", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(isRateLimited("ip-a", 3, 60_000)).toBe(false);
    }
    expect(isRateLimited("ip-b", 3, 60_000)).toBe(false);
  });

  it("a janela desliza: após windowMs o acesso é aceito de novo", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(isRateLimited("ip", 3, 60_000)).toBe(false);
    }
    expect(isRateLimited("ip", 3, 60_000)).toBe(true);

    vi.advanceTimersByTime(60_001);

    expect(isRateLimited("ip", 3, 60_000)).toBe(false);
  });

  it("o acesso recusado NÃO estende a janela (recusar seguido não empurra o desbloqueio)", () => {
    for (let i = 0; i < 2; i += 1) {
      expect(isRateLimited("ip", 2, 60_000)).toBe(false);
    }
    // Dois golpes recusados não entram na janela: se entrassem, cada golpe
    // adiado renova o bloqueio e a chave nunca seria liberada.
    expect(isRateLimited("ip", 2, 60_000)).toBe(true);
    expect(isRateLimited("ip", 2, 60_000)).toBe(true);

    // Dentro da janela dos 2 aceitos: ainda recusado.
    vi.advanceTimersByTime(59_999);
    expect(isRateLimited("ip", 2, 60_000)).toBe(true);
    // A janela dos 2 aceitos expirou (t=0 + 60s): liberado.
    vi.advanceTimersByTime(2);
    expect(isRateLimited("ip", 2, 60_000)).toBe(false);
  });
});
