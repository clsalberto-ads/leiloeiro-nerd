// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// ponytail: ver src/components/bid-form.test.tsx — a action real arrastaria
// drizzle/pg/resend/better-auth para dentro do grafo de import.
vi.mock("@/presentation/actions/bid-actions", () => ({ placeBidAction: vi.fn() }));

import { fireEvent, render, screen, waitFor } from "@/test/dom-render";
import { BidForm } from "./bid-form";

const ITEM_ID = "3f6c1f6e-1d5a-4f1e-9b6a-2f0b1c3d4e5f";
const MIN_BID = 5000;
const LABEL = "Seu lance (R$)";

function field(): HTMLInputElement {
  return screen.getByLabelText(LABEL) as HTMLInputElement;
}

function hiddenAmount(): HTMLInputElement {
  return document.querySelector('input[type="hidden"][name="amount"]') as HTMLInputElement;
}

function form(): HTMLFormElement {
  return document.querySelector("form") as HTMLFormElement;
}

// ponytail: escopo por id (`[id$="-error"]`, o id que `Field` monta), e nao
// `[role="alert"]` cru: o proprio bid-form renderiza o erro de servidor
// (state.error) antes dos campos.
function alertText(): string | null {
  return document.querySelector('[role="alert"][id$="-error"]')?.textContent ?? null;
}

/** ponytail: `mode: "onTouched"` — so o blur dispara o resolver. */
async function typeAndBlur(value: string): Promise<HTMLInputElement> {
  const el = field();
  fireEvent.change(el, { target: { value } });
  fireEvent.blur(el);
  return el;
}

describe("BidForm — erro de campo no DOM real", () => {
  it("nao mostra erro antes de qualquer interacao e mantem o payload inicial em centavos", () => {
    render(<BidForm itemId={ITEM_ID} minBid={MIN_BID} />);

    expect(alertText()).toBe(null);
    expect(field().getAttribute("aria-invalid")).toBe("false");
    expect(hiddenAmount().value).toBe("5000");
  });

  it("revela o erro de lance abaixo do minimo do item no blur", async () => {
    render(<BidForm itemId={ITEM_ID} minBid={MIN_BID} />);

    const el = await typeAndBlur("10");

    await waitFor(() => expect(alertText()).toBe("Lance mínimo R$ 50,00"));
    expect(el.getAttribute("aria-invalid")).toBe("true");
    expect(el.getAttribute("aria-describedby")).toBe("amount-error");
    expect(document.getElementById("amount-error")?.getAttribute("role")).toBe("alert");
  });

  // ponytail: este e o teste que distingue `onTouched` de `onBlur`: so o
  // `onTouched` revalida a cada tecla depois do primeiro toque, entao o erro
  // some sem exigir um novo blur. Com `onBlur` o erro ficaria stale.
  it("limpa o erro assim que o lance passa a ser valido, sem novo blur", async () => {
    render(<BidForm itemId={ITEM_ID} minBid={MIN_BID} />);
    const el = await typeAndBlur("10");
    await waitFor(() => expect(alertText()).toBe("Lance mínimo R$ 50,00"));

    fireEvent.change(el, { target: { value: "50" } });

    await waitFor(() => expect(alertText()).toBe(null));
    expect(el.getAttribute("aria-invalid")).toBe("false");
    expect(el.getAttribute("aria-describedby")).toBe(null);
  });

  it("rejeita o campo vazio com a mensagem de lance invalido", async () => {
    render(<BidForm itemId={ITEM_ID} minBid={MIN_BID} />);

    fireEvent.blur(field());

    await waitFor(() => expect(alertText()).toBe("Lance inválido"));
    expect(field().getAttribute("aria-invalid")).toBe("true");
  });

  it("rejeita lance nao positivo", async () => {
    render(<BidForm itemId={ITEM_ID} minBid={MIN_BID} />);

    await typeAndBlur("0");

    await waitFor(() => expect(alertText()).toBe("Lance inválido"));
  });

  it("converte o valor digitado em reais para centavos no campo hidden", async () => {
    render(<BidForm itemId={ITEM_ID} minBid={MIN_BID} />);

    fireEvent.change(field(), { target: { value: "50" } });
    await waitFor(() => expect(hiddenAmount().value).toBe("5000"));

    fireEvent.change(field(), { target: { value: "123.45" } });
    await waitFor(() => expect(hiddenAmount().value).toBe("12345"));
  });

  // ponytail: o teste do FormData e a defesa final do contrato do payload. Se
  // alguem devolver `name="amount"` ao input visivel, o servidor recebe o
  // FormData com dois `amount` e `formToObject` fica com o ultimo.
  it("manda o FormData com amount em centavos e o itemId, e nada de amount em reais", async () => {
    render(<BidForm itemId={ITEM_ID} minBid={MIN_BID} />);

    fireEvent.change(field(), { target: { value: "75.5" } });

    const data = new FormData(form());
    expect(data.getAll("amount")).toEqual(["7550"]);
    expect(data.get("itemId")).toBe(ITEM_ID);
  });
});
