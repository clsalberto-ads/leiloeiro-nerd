import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  getItemBidsAction: vi.fn(),
  placeBidAction: vi.fn(),
}));

vi.mock("@/presentation/actions/bid-actions", () => ({
  getItemBidsAction: mocks.getItemBidsAction,
  placeBidAction: mocks.placeBidAction,
}));

import { BidSection } from "@/components/bid-section";
import type { Bid } from "@/domain/repositories/bid-repository";

function makeBid(overrides: Partial<Bid> = {}): Bid {
  return {
    id: "b1",
    itemId: "i1",
    bidderId: "u2",
    bidderName: "Ana",
    amount: 15000,
    rank: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function render(itemId: string, initialBids: Bid[], minInitialBid: number, minBidIncrement: number) {
  return renderToString(
    <BidSection itemId={itemId} initialBids={initialBids} minInitialBid={minInitialBid} minBidIncrement={minBidIncrement} />,
  );
}

describe("BidSection", () => {
  it("renderiza formulário com lance mínimo inicial quando não há lances", () => {
    const html = render("i1", [], 10000, 500);
    expect(html).toContain("Dar lance");
    expect(html).toContain("placeholder=\"Mínimo R$ 100,00\"");
    expect(html).toContain("Nenhum lance ainda.");
  });

  it("renderiza histórico e recalcula mínimo a partir do maior lance", () => {
    const html = render("i1", [makeBid()], 10000, 500);
    expect(html).toContain("150,00");
    expect(html).toContain(">Ana<");
    expect(html).toContain("placeholder=\"Mínimo R$ 155,00\"");
  });

  it("não dispara o polling durante o render inicial (intervalo de 10s)", () => {
    render("i1", [makeBid()], 10000, 500);
    expect(mocks.getItemBidsAction).not.toHaveBeenCalled();
  });
});