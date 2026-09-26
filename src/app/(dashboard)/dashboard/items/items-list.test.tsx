import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { Item } from "@/domain/repositories/item-repository";

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

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "i1",
    sellerId: "u1",
    title: "Console retrô",
    description: "Console retrô completo com caixa.",
    type: "product",
    imageUrl: null,
    minInitialBid: 10000,
    minBidIncrement: 500,
    bidDeadline: new Date("2026-10-01T00:00:00Z"),
    paymentDeadlineDays: 3,
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("ItemsList", () => {
  it("renderiza BidCountdown com bidDeadline quando o item está ativo", () => {
    renderToString(<ItemsList items={[makeItem()]} current="all" />);
    expect(mocks.BidCountdown.mock.calls[0][0]).toMatchObject({ deadline: expect.any(Date) });
  });

  // ponytail: o `/<th[\s\S]*?Lance mínimo/` e o que segura o "cabeçalho de
  // coluna" no nome. Um `toContain("Lance mínimo")` sozinho passaria com a lista
  // antiga em `<li>`, onde o texto aparecia no parágrafo "Lance mínimo: R$ …" —
  // o teste ficaria verde com a coluna inexistente.
  it("renderiza Lance mínimo como cabeçalho de coluna", () => {
    const html = renderToString(<ItemsList items={[makeItem()]} current="all" />);
    expect(html).toMatch(/<th[\s\S]*?Lance mínimo/);
  });
});