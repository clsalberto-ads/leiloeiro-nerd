// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// ponytail: ver src/components/bid-form.test.tsx — a action real arrastaria
// drizzle/pg/resend/better-auth para dentro do grafo de import.
vi.mock("@/presentation/actions/bid-actions", () => ({ placeBidAction: vi.fn() }));

import { fireEvent, render, screen, waitFor } from "@/test/dom-render";
import { placeBidSchema } from "@/lib/validators";
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

  // ponytail: `minBid` de 100 e o piso que o `itemSchema` ainda permite a um
  // item novo. Este e o teste que fecha a mutacao do piso do servidor: se o
  // `MIN_BID_CENTAVOS` subir, o cliente passa a exigir o novo piso AQUI (R$ 2,00
  // vira erro) em vez de aceitar um lance que a action vai rejeitar.
  it("aceita lance acima do piso do item com o item no minimo legal", async () => {
    render(<BidForm itemId={ITEM_ID} minBid={100} />);

    await typeAndBlur("2");

    await waitFor(() => expect(alertText()).toBe(null));
    expect(field().getAttribute("aria-invalid")).toBe("false");
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
  // O `safeParse` e o que fecha o contrato: nao basta o HTML ter as chaves
  // certas, o payload tem de passar pelo MESMO schema da action. O
  // `amountReais` extra e inofensivo porque o `z.object` do placeBidSchema
  // descarta chave desconhecida (strip) — a action so le `itemId` e `amount`.
  it("manda o FormData com amount em centavos e o itemId, e nada de amount em reais", async () => {
    render(<BidForm itemId={ITEM_ID} minBid={MIN_BID} />);

    fireEvent.change(field(), { target: { value: "75.5" } });

    const data = new FormData(form());
    expect(data.getAll("amount")).toEqual(["7550"]);
    expect(data.get("itemId")).toBe(ITEM_ID);
    expect(placeBidSchema.safeParse(Object.fromEntries(data.entries())).success).toBe(true);
  });

  // ponytail: `75.5` e `123.45` acima sao float-CLEAN no IEEE-754 — `123.45 * 100
  // === 12345` e `75.5 * 100 === 7550` exatos. O `1.15` deste caso e float-DIRTY:
  // `1.15 * 100` da `114.99999999999999` em double. Sem o `Math.round` de
  // bid-form.tsx:43 o hidden vira esse valor, o FormData carrega
  // `"114.99999999999999"`, e o `.int("Lance inválido")` do placeBidSchema — o
  // MESMO schema da action — reprova o lance de um usuario que digitou um valor
  // perfeitamente legitimo. Este e o teste que fecha essa mutacao: apagar o
  // `Math.round` da producao deixa a suite verde sem ele.
  // `minBid` de 100 (item de R$ 1,00) e o que torna o cenario real: R$ 1,15 e
  // um lance VALIDO acima do piso, nao um valor que o min do input rejeitaria.
  it("arredonda o float sujo do valor digitado em centavos inteiros antes de mandar o FormData", async () => {
    render(<BidForm itemId={ITEM_ID} minBid={100} />);

    fireEvent.change(field(), { target: { value: "1.15" } });

    expect(hiddenAmount().value).toBe("115");

    const data = new FormData(form());
    expect(data.getAll("amount")).toEqual(["115"]);
    expect(placeBidSchema.safeParse(Object.fromEntries(data.entries())).success).toBe(true);
  });
});
