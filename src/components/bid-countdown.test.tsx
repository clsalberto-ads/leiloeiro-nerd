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
    // 2026-09-20T11:00:00Z == 20/09/2026 08:00 em America/Sao_Paulo (UTC-3). Este
    // caso fixava `11:00` — a saida UTC que a correcao trocou por `08:00`. A
    // virgula antes das horas vem do `toLocaleString("pt-BR", ...)`.
    const deadline = new Date("2026-09-20T11:00:00Z"); // specific date for snapshot
    const html = renderToString(<BidCountdown deadline={deadline} />);
    expect(html).toContain('<span class="sr-only">Prazo: 20/09/2026, 08:00</span>');
  });

  // O prazo que o LEITOR DE TELA ouve, em FUSO do produto. Antes desta correção
  // o `sr-only` formatava com `getUTCDate()`, e um deadline de 30/09 23:59 (fuso
  // de Sao Paulo) aparecia como "1/10 2:59" — um dia e tres horas errado. O
  // countdown numerico contava certo, entao o bug era invisivel olhando o numero.
  it("anuncia o prazo absoluto no fuso do produto, nao em UTC", () => {
    // 2026-10-01T02:59:00Z == 30/09/2026 23:59 em America/Sao_Paulo (UTC-3).
    // O `toLocaleString("pt-BR", ...)` quebra a data e a hora com VIRGULA.
    const html = renderToString(<BidCountdown deadline={new Date("2026-10-01T02:59:00Z")} />);
    expect(html).toContain("30/09/2026");
    expect(html).toContain("23:59");
    expect(html).not.toContain("1/10/2026");
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
