// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// ponytail: ver src/components/become-seller-form.test.tsx — a action real
// arrastaria drizzle/pg/better-auth para dentro do grafo de import.
vi.mock("@/presentation/actions/profile-actions", () => ({ becomeSellerAction: vi.fn() }));

import { fireEvent, render, screen, waitFor } from "@/test/dom-render";
import { BecomeSellerForm } from "./become-seller-form";

const SLUG_LABEL = "Slug da vitrine";
const ROLE_LABEL = "Ativar como";

function slugField(): HTMLInputElement {
  return screen.getByLabelText(SLUG_LABEL) as HTMLInputElement;
}

function form(): HTMLFormElement {
  return document.querySelector("form") as HTMLFormElement;
}

function preview(): HTMLElement | null {
  return screen.queryByText(/^leiloeironerd\.com\//);
}

function alertText(): string | null {
  return document.querySelector('[role="alert"][id$="-error"]')?.textContent ?? null;
}

describe("BecomeSellerForm — pre-visualizacao de slug no DOM real", () => {
  it("nao mostra pre-visualizacao antes de digitar", () => {
    render(<BecomeSellerForm />);

    expect(preview()).toBe(null);
  });

  // ponytail: o preview e o `createSlug` sobre o valor atual, recalculado a cada
  // tecla. Um `useMemo` com dependencia errada (ou um `getValues` sem
  // `watch`) deixa o preview stale e este teste e o que acusa.
  it("converte o que o usuario digita em slug e atualiza a cada tecla", () => {
    render(<BecomeSellerForm />);

    fireEvent.change(slugField(), { target: { value: "Nerd Colecionáveis" } });
    expect(preview()?.textContent).toBe("leiloeironerd.com/nerd-colecionaveis");

    fireEvent.change(slugField(), { target: { value: "Nerd Colecionáveis 2026" } });
    expect(preview()?.textContent).toBe("leiloeironerd.com/nerd-colecionaveis-2026");
  });

  it("some com a pre-visualizacao quando o texto nao gera slug", () => {
    render(<BecomeSellerForm />);
    fireEvent.change(slugField(), { target: { value: "nerd" } });
    expect(preview()).not.toBe(null);

    fireEvent.change(slugField(), { target: { value: "!!!" } });

    expect(preview()).toBe(null);
  });

  it("manda no FormData o slug cru e o papel padrao", () => {
    render(<BecomeSellerForm />);

    fireEvent.change(slugField(), { target: { value: "Nerd Colecionáveis" } });

    const data = new FormData(form());
    expect(data.get("slug")).toBe("Nerd Colecionáveis");
    expect(data.get("role")).toBe("seller");
  });

  it("atualiza o papel escolhido no payload", () => {
    render(<BecomeSellerForm />);
    const role = screen.getByLabelText(ROLE_LABEL) as HTMLSelectElement;

    fireEvent.change(role, { target: { value: "both" } });

    expect(new FormData(form()).get("role")).toBe("both");
  });
});

describe("BecomeSellerForm — erro de campo no DOM real", () => {
  it("nao mostra erro antes de qualquer interacao", () => {
    render(<BecomeSellerForm />);

    expect(alertText()).toBe(null);
    expect(slugField().getAttribute("aria-invalid")).toBe("false");
  });

  it("revela o erro de slug obrigatorio no blur do campo vazio", async () => {
    render(<BecomeSellerForm />);

    fireEvent.blur(slugField());

    await waitFor(() => expect(alertText()).toBe("Slug obrigatório"));
    expect(slugField().getAttribute("aria-invalid")).toBe("true");
    expect(slugField().getAttribute("aria-describedby")).toBe("slug-error");
    expect(document.getElementById("slug-error")?.getAttribute("role")).toBe("alert");
  });

  it("limpa o erro assim que o slug passa a ser valido, sem novo blur", async () => {
    render(<BecomeSellerForm />);
    fireEvent.blur(slugField());
    await waitFor(() => expect(alertText()).toBe("Slug obrigatório"));

    fireEvent.change(slugField(), { target: { value: "nerd-colecionaveis" } });

    await waitFor(() => expect(alertText()).toBe(null));
    expect(slugField().getAttribute("aria-invalid")).toBe("false");
  });

  it("revela o erro de slug que o createSlug rejeita", async () => {
    render(<BecomeSellerForm />);

    const el = slugField();
    fireEvent.change(el, { target: { value: "a".repeat(61) } });
    fireEvent.blur(el);

    await waitFor(() => expect(alertText()).toBe("Slug excede 60 caracteres"));
    expect(el.getAttribute("aria-invalid")).toBe("true");
  });
});
