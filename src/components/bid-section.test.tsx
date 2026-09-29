// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/dom-render";
import { BidSection } from "./bid-section";
import type { Bid } from "@/domain/repositories/bid-repository";

vi.mock("@/presentation/actions/bid-actions", () => ({
  getItemBidsAction: vi.fn(async () => ({ ok: true })),
  // o `BidForm` importa o mesmo modulo; so o `render` e o que importa aqui
  placeBidAction: vi.fn(async () => ({ ok: true })),
}));

const LANCE: Bid = {
  id: "b1",
  itemId: "i1",
  bidderId: "u2",
  bidderName: "Ana",
  amount: 6500,
  rank: 1,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

// ponytail: `item.status` nao diz que o leilao esta aberto. NADA no sistema
// transiciona `active -> closed` (o unico `setStatus` e o `cancelled`; o worker
// do cron e um stub), entao um item cujo prazo passou continua `active` para
// sempre. Antes do `deadline` descer ate aqui, a pagina renderizava o
// `BidCountdown` dizendo "Encerrado" e, logo abaixo, um `BidForm` com o botao
// "Dar lance" HABILITADO: o usuario preenchia o valor, enviava, e so recebia
// "Leilao encerrado" do servidor. Duas camadas da mesma tela discordando.
describe("BidSection — leilao encerrado", () => {
  const props = { itemId: "i1", initialBids: [LANCE], minInitialBid: 5000, minBidIncrement: 500 };

  it("esconde o formulario e diz que nao aceita mais lances quando o prazo passou", () => {
    render(<BidSection {...props} deadline={new Date(Date.now() - 1000)} />);
    expect(screen.queryByRole("button", { name: /dar lance/i })).toBeNull();
    expect(screen.getByText(/encerrado/i)).toBeTruthy();
  });

  it("ainda mostra o historico, para o comprador ver o lance vencedor", () => {
    render(<BidSection {...props} deadline={new Date(Date.now() - 1000)} />);
    // 404 aqui esconderia o resultado do leilao encerrado
    expect(screen.getByText("R$ 65,00")).toBeTruthy();
  });

  it("mantem o formulario quando o prazo ainda vai Vencer", () => {
    render(<BidSection {...props} deadline={new Date(Date.now() + 3_600_000)} />);
    expect(screen.getByRole("button", { name: /dar lance/i })).toBeTruthy();
  });

  it("mantem o formulario quando o item nao tem prazo", () => {
    render(<BidSection {...props} />);
    expect(screen.getByRole("button", { name: /dar lance/i })).toBeTruthy();
  });
});
