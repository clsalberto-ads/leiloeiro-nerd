import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRateLimited, resetRateLimits } from "./rate-limit";

// `Date.now` mockado: a janela é tempo, e o teste precisa de controle exato
// sobre ele em vez de `sleep`. `isRateLimited` é async (backend Redis na
// produção) mas o teste roda no IN-MEMORY (sem REDIS_URL), e o await é apenas
// microtask — os fake timers só mexem em Date.now/setTimeout.
beforeEach(() => {
  vi.useFakeTimers();
  resetRateLimits();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isRateLimited", () => {
  it("aceita até o limite e recusa o excedente", async () => {
    for (let i = 0; i < 3; i += 1) {
      expect(await isRateLimited("ip", 3, 60_000)).toBe(false);
    }
    expect(await isRateLimited("ip", 3, 60_000)).toBe(true);
  });

  it("chaves diferentes têm janelas independentes", async () => {
    for (let i = 0; i < 3; i += 1) {
      expect(await isRateLimited("ip-a", 3, 60_000)).toBe(false);
    }
    expect(await isRateLimited("ip-b", 3, 60_000)).toBe(false);
  });

  it("a janela desliza: após windowMs o acesso é aceito de novo", async () => {
    for (let i = 0; i < 3; i += 1) {
      expect(await isRateLimited("ip", 3, 60_000)).toBe(false);
    }
    expect(await isRateLimited("ip", 3, 60_000)).toBe(true);

    vi.advanceTimersByTime(60_001);

    expect(await isRateLimited("ip", 3, 60_000)).toBe(false);
  });

  it("o acesso recusado NÃO estende a janela", async () => {
    for (let i = 0; i < 2; i += 1) {
      expect(await isRateLimited("ip", 2, 60_000)).toBe(false);
    }
    expect(await isRateLimited("ip", 2, 60_000)).toBe(true);
    expect(await isRateLimited("ip", 2, 60_000)).toBe(true);

    // Dentro da janela dos 2 aceitos: ainda recusado.
    vi.advanceTimersByTime(59_999);
    expect(await isRateLimited("ip", 2, 60_000)).toBe(true);
    // A janela dos 2 aceitos expirou (t=0 + 60s): liberado.
    vi.advanceTimersByTime(2);
    expect(await isRateLimited("ip", 2, 60_000)).toBe(false);
  });
});
