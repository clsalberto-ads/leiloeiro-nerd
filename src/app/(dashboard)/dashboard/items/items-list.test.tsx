import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { DashboardItemRow } from "./dashboard-item-row";

const mocks = vi.hoisted(() => ({
  BidCountdown: vi.fn<(props: { deadline: Date }) => null>(),
}));

vi.mock("@/components/bid-countdown", () => ({
  BidCountdown: mocks.BidCountdown,
}));

vi.mock("@/presentation/actions/item-actions", () => ({
  cancelItemAction: vi.fn(),
  deleteItemAction: vi.fn(),
  publishItemAction: vi.fn(),
}));

import { ItemsList } from "./items-list";
import { DEFAULT_TABLE_VIEW } from "./dashboard-table-state";

// ponytail: o item deste arquivo tem os SEIS campos do DTO e nao os doze do
// `Item`. Renderizar a lista com um `Item` completo nao provaria nada sobre a
// fronteira de serializacao — o ponto do DTO e que a lista funciona com o
// minimo, e um item de 12 campos aceito aqui seria o mesmo codigo funcionando
// com 6.
function makeItem(overrides: Partial<DashboardItemRow> = {}): DashboardItemRow {
  return {
    id: "i1",
    title: "Console retrô",
    type: "product",
    minInitialBid: 10000,
    bidDeadline: new Date("2026-10-01T00:00:00Z"),
    status: "active",
    ...overrides,
  };
}

function list(item: DashboardItemRow): string {
  return renderToString(
    <ItemsList items={[item]} view={DEFAULT_TABLE_VIEW} totalCount={1} navigate={() => {}} />,
  );
}

describe("ItemsList", () => {
  it("renderiza BidCountdown com bidDeadline quando o item está ativo", () => {
    list(makeItem());
    expect(mocks.BidCountdown.mock.calls[0][0]).toMatchObject({ deadline: expect.any(Date) });
  });

  // ponytail: o `/<th[\s\S]*?Lance mínimo/` e o que segura o "cabeçalho de
  // coluna" no nome. Um `toContain("Lance mínimo")` sozinho passaria com a lista
  // antiga em `<li>`, onde o texto aparecia no parágrafo "Lance mínimo: R$ …" —
  // o teste ficaria verde com a coluna inexistente.
  it("renderiza Lance mínimo como cabeçalho de coluna", () => {
    expect(list(makeItem())).toMatch(/<th[\s\S]*?Lance mínimo/);
  });

  // ponytail: a outra metade do fuso, e a que fecha o ciclo da hidratacao: o
  // `items-list.dom.test.tsx` prova o texto no cliente, este prova o HTML que o
  // servidor manda. Sao os dois lados do mesmo `toLocaleDateString`, e a
  // hidratacao so fica sem divergencia se eles concordarem. O instante e o
  // `2026-10-01T00:00:00Z` do `makeItem` — meia-noite UTC e o pior caso: o dia
  // do prazo vira o dia anterior em qualquer fuso a oeste de Greenwich. Com o
  // processo forcado em UTC, um `toLocaleDateString` sem `timeZone` imprimiria
  // "01/10/2026"; o vendedor que digitou "30/09 22:00" no `item-form` veria o
  // prazo que cadastrou.
  it("renderiza o prazo no fuso do produto, e nao no fuso do processo", () => {
    const originalTimezone = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const html = list(makeItem());
      expect(html).toContain("30/09/2026");
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });
});