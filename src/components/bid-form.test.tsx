import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

// ponytail: o bid-form importa a server action real, que arrasta drizzle, pg,
// resend e better-auth para dentro do grafo de import do teste.
vi.mock("@/presentation/actions/bid-actions", () => ({ placeBidAction: vi.fn() }));

import { BidForm } from "./bid-form";

const ITEM_ID = "3f6c1f6e-1d5a-4f1e-9b6a-2f0b1c3d4e5f";

function tagOf(html: string, id: string): string {
  const tag = html.match(new RegExp(`<input[^>]*\\sid="${id}"[^>]*>`))?.[0];
  expect(tag, `nenhuma tag de input com id="${id}" no HTML renderizado`).toBeDefined();
  return tag!;
}

describe("BidForm", () => {
  it("rotula o campo de lance e liga o label ao input pelo mesmo id", () => {
    const html = renderToString(<BidForm itemId={ITEM_ID} minBid={5000} />);
    expect(html).toContain("Seu lance (R$)");
    expect(html.match(/for="([^"]+)"[^>]*>Seu lance/)?.[1]).toBe("amount");
  });

  it("mantem o campo visivel em reais: min, step e placeholder sao do valor em reais", () => {
    const tag = tagOf(renderToString(<BidForm itemId={ITEM_ID} minBid={5000} />), "amount");
    expect(tag).toContain('type="number"');
    expect(tag).toContain('step="0.01"');
    expect(tag).toContain('min="50"');
    expect(tag).toContain('placeholder="Mínimo R$ 50,00"');
    expect(tag).toContain('required=""');
  });

  // ponytail: o campo em reais e o campo do RHF se chamam `amountReais` porque
  // o `onChange` do RHF le o `name` do input no DOM: um `name="amount"` aqui
  // brigaria com o `amount` em centavos do payload no FormData.
  it("da name proprio ao input visivel em reais, sem colidir com o amount em centavos", () => {
    const tag = tagOf(renderToString(<BidForm itemId={ITEM_ID} minBid={5000} />), "amount");
    expect(tag).toContain('name="amountReais"');
    expect(renderToString(<BidForm itemId={ITEM_ID} minBid={5000} />)).toContain('<input type="hidden" name="amount" value="5000"/>');
  });

  it("envia amount em centavos e itemId como inputs hidden", () => {
    const html = renderToString(<BidForm itemId={ITEM_ID} minBid={5000} />);
    expect(html).toContain(`<input type="hidden" name="amount" value="5000"/>`);
    expect(html).toContain(`<input type="hidden" name="itemId" value="${ITEM_ID}"/>`);
  });

  it("deriva o payload em centavos do minimo em centavos do item", () => {
    const html = renderToString(<BidForm itemId={ITEM_ID} minBid={123456} />);
    expect(html).toContain(`<input type="hidden" name="amount" value="123456"/>`);
    expect(html).toContain('min="1234.56"');
    expect(html).toContain('placeholder="Mínimo R$ 1.234,56"');
  });

  it("nao renderiza erro de campo antes de qualquer interacao", () => {
    const html = renderToString(<BidForm itemId={ITEM_ID} minBid={5000} />);
    expect(html).not.toContain('id="amount-error"');
    expect(tagOf(html, "amount")).toContain('aria-invalid="false"');
  });

  it("mantem o botao de envio com o texto do lance", () => {
    const html = renderToString(<BidForm itemId={ITEM_ID} minBid={5000} />);
    expect(html).toContain("Dar lance");
  });
});
