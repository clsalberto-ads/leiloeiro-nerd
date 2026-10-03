// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@/test/dom-render";
import { ItemsByStatusChart } from "./items-by-status-chart";
import { SellerSeriesChart } from "./series-chart-seller";
import { BuyerBidChart } from "./bid-chart-buyer";

// ponytail: estes testes existem porque "o grafico nao aparece" NAO falha em
// `tsc`, nao falha no `build`, e nao falha em nenhum teste que so verifique
// `getByText("Itens no total")` — a pagina renderiza, o `Card` aparece, e o
// grafico e um `<svg>` de 0x0 silencioso.
//
// Eles dependem de `isAnimationActive={false}` nos `<Bar>`/`<Area>`. Com a
// animacao de montagem LIGADA, o Recharts desenha a barra de altura 0 e cresce
// por requestAnimationFrame: em jsdom nenhum frame corre dentro do `render`, e o
// DOM fica com `<g class="recharts-bar-rectangle">` VAZIO — que passa em
// "existe um svg" e falha em "existe uma barra". Desligar a animacao e a decisao
// certa de producao pelo motivo do `ponytail:` nos grafos (WCAG 2.3.3, e o
// grafico remonta a cada `?periodo`, o que daria um flash por clique); aqui e
// so o que torna a geometria observavel.

// `total` comeca em 1, e nao em 0: o Recharts NAO desenha a barra de altura zero
// (o `path` simplesmente nao existe), entao um fixture que comecasse em zero teria
// 29 barras para 30 pontos e a contagem de "uma barra por dia" mentiria.
const DIAS = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 8, 1 + i));
  return { day: d.toISOString().slice(0, 10), total: i + 1 };
});

/** As geometrias desenhadas de verdade — `path` com `fill`, dentro do retangulo. */
function barras(container: HTMLElement) {
  return [...container.querySelectorAll(".recharts-bar-rectangle path")];
}

// ponytail: o caminho do tick mudou no Recharts 3 e o seletor antigo morreu
// quieto. O texto do tick NAO esta mais sob `.recharts-xAxis`: ele vive dentro
// de um `recharts-zIndex-layer_2000`, que a v3 introduziu para ordenar as
// camadas desenhadas. A classe do texto continua
// `.recharts-cartesian-axis-tick-value`, mas ela e a MESMA no Y — e sem
// filtrar, um teste de formato de data recebia os ticks da escala ("0", "2",
// "4"...) junto. O que separa os eixos agora e o wrapper `recharts-xAxis-tick-labels`
// (no PLURAL — o singular `.recharts-xAxis-tick-label` casa com zero elementos e
// devolve um array vazio que passa em `toHaveLength(0)` sem explicar nada).
function xTicks(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll(".recharts-xAxis-tick-labels text")].map((n) => n.textContent);
}

describe("graficos do dashboard", () => {
  it("o grafico de status desenha uma barra por linha, com geometria", () => {
    const { container } = render(
      <ItemsByStatusChart
        itemsByStatus={[
          { status: "active", total: 2 },
          { status: "draft", total: 3 },
        ]}
      />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
    expect(barras(container)).toHaveLength(2);
    // altura maior = mais itens: a barra "draft" (3) tem de ser mais alta
    const altura = barras(container).map((p) => Number(p.getAttribute("height")));
    expect(altura[1]).toBeGreaterThan(altura[0]);
  });

  // ponytail: o `fill` vem do DADO (`fill: TONS[status]`), nao do `dataKey`. Um
  // `var(--color-chart-9)` typoado passaria no `tsc` e so apareceria como barra
  // invisivel. E dois status diferentes nao podem receber a mesma cor — foi
  // exatamente o defeito da paleta monocromatica original (cinza, cinco tons).
  it("cada status recebe uma cor da paleta, e status diferentes cores distintos", () => {
    const { container } = render(
      <ItemsByStatusChart
        itemsByStatus={[
          { status: "active", total: 2 },
          { status: "draft", total: 3 },
        ]}
      />,
    );
    const fills = barras(container).map((p) => p.getAttribute("fill"));
    for (const f of fills) expect(f).toMatch(/^var\(--color-chart-\d\)$/);
    expect(new Set(fills).size).toBe(2);
  });

  it("o nome acessivel de cada barra e o rotulo do status, nunca 'undefined'", () => {
    const { container } = render(
      <ItemsByStatusChart
        itemsByStatus={[
          { status: "active", total: 2 },
          { status: "draft", total: 3 },
        ]}
      />,
    );
    const names = barras(container).map((p) => p.getAttribute("name"));
    // sem `name` no dado, o Recharts escreve literalmente `name="undefined"`
    expect(names.every((n) => n && n !== "undefined")).toBe(true);
    expect(names).toContain("Em leilão");
  });

  // ponytail: o rotulo do eixo vem de `STATUS_LABELS`, do DOMINIO. Copiar o
  // mapa para o componente criaria a segunda fonte de verdade que o
  // `item-status-badge.tsx` existe para impedir; este teste e o que acusa a
  // copia se ela voltar.
  it("o eixo de status usa STATUS_LABELS do dominio", () => {
    const { container } = render(
      <ItemsByStatusChart
        itemsByStatus={[
          { status: "active", total: 2 },
          { status: "awaiting_payment", total: 1 },
        ]}
      />,
    );
    const ticks = xTicks(container);
    expect(ticks).toContain("Em leilão");
    expect(ticks).toContain("Aguardando pagamento");
  });

  it("o grafico de series desenha as DUAS series do vendedor", () => {
    const { container } = render(
      <SellerSeriesChart bidsPerDay={DIAS} itemsCreatedPerDay={DIAS} description="últimos 30 dias" />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelectorAll(".recharts-area").length).toBe(2);
    expect(container.querySelectorAll(".recharts-area-curve").length).toBeGreaterThan(0);
  });

  it("o grafico do comprador desenha uma serie so, com uma barra por dia", () => {
    const { container } = render(<BuyerBidChart bidsPerDay={DIAS} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(barras(container)).toHaveLength(30);
  });

  // ponytail: 30 marcadores com "2026-09-01" inteiro nao cabem em 240px e se
  // sobrepoem. O `minTickGap` deixa o Recharts pular ticks que nao couberem, mas
  // o `tickFormatter` e o que garante que o que SOBRE seja legivel.
  it("o eixo do tempo mostra dia/mes, e nao a data ISO inteira", () => {
    const { container } = render(<BuyerBidChart bidsPerDay={DIAS} />);
    const ticks = xTicks(container).filter((t): t is string => Boolean(t));
    expect(ticks.length).toBeGreaterThan(0);
    // o Recharts PULA ticks que nao couberem (`minTickGap`), entao a lista nao
    // tem os 30 dias — o que se verifica e o FORMATO de cada tick, nao a
    // presenca de um dia especifico.
    for (const t of ticks) expect(t).toMatch(/^\d{1,2}\/\d{2}$/);
    expect(ticks.some((t) => t.includes("2026-"))).toBe(false);
  });

  it("nao quebra com lista vazia", () => {
    expect(() => render(<BuyerBidChart bidsPerDay={[]} />)).not.toThrow();
    expect(() => render(<ItemsByStatusChart itemsByStatus={[]} />)).not.toThrow();
  });
});
