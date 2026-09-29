import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { BidCountdown } from "./bid-countdown";

// Mock Date.now() to control time in tests
const realDateNow = Date.now;
vi.spyOn(global.Date, "now").mockReturnValue(new Date("2026-09-20T10:00:00Z").getTime());

describe("BidCountdown", () => {
  // ponytail: o teste anterior exigia `aria-live="polite"` e therefore fixava o
  // defeito. `role="timer"` implica `aria-live="off"`; o `polite` sobrescrevia
  // e o leitor de tela anunciava o relogio 1x/segundo pelo leilao inteiro. Este
  // e o teste que trava o NAO-anuncio: o `role="timer"` sozinho ja e o
  // comportamento correto, e o prazo absoluto continua exposto no `sr-only`.
  it("não marca a contagem como aria-live (evita anunciar a cada segundo)", () => {
    const deadline = new Date(Date.now() + 3600_000); // 1 hour from now
    const html = renderToString(<BidCountdown deadline={deadline} />);
    expect(html).toContain('role="timer"');
    expect(html).not.toContain("aria-live");
  });

  it("não marca 'Encerrado' como aria-live", () => {
    const deadline = new Date(Date.now() - 3600_000);
    const html = renderToString(<BidCountdown deadline={deadline} />);
    expect(html).toContain('role="timer"');
    expect(html).not.toContain("aria-live");
  });

  it("exibe o texto para screen readers com o prazo absoluto", () => {
    const deadline = new Date("2026-09-20T11:00:00Z"); // specific date for snapshot
    const html = renderToString(<BidCountdown deadline={deadline} />);
    expect(html).toContain('<span class="sr-only">Prazo: 20/09/2026 11:00</span>');
  });

  it("desabilita animacao com prefers-reduced-motion", () => {
    // This test would typically require a way to mock CSS media queries,
    // which is not directly possible with renderToString.
    // We'll rely on the class being present, assuming the CSS handles it.
    const deadline = new Date(Date.now() + 3600_000);
    const html = renderToString(<BidCountdown deadline={deadline} />);
    expect(html).toContain('motion-reduce:animate-none');
  });

  it("exibe 'Encerrado' quando o prazo expirou", () => {
    const deadline = new Date(Date.now() - 3600_000); // 1 hour ago
    const html = renderToString(<BidCountdown deadline={deadline} />);
    expect(html).toContain("Encerrado");
  });

  it("formata o tempo corretamente", () => {
    const deadline = new Date(Date.now() + 86400000 + 3600000 + 60000 + 1000); // 1 day, 1 hour, 1 min, 1 sec
    const html = renderToString(<BidCountdown deadline={deadline} />);
    expect(html).toContain("1 d 1 h 1 min 1 s");
  });
});
