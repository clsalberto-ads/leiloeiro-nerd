// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// O register-form importa a server action real, que arrasta better-auth,
// drizzle e pg para dentro do grafo de import. O mock mantem o harness DOM
// isolado de banco — o escopo aqui e a validacao client-side do RHF.
vi.mock("@/presentation/actions/auth-actions", () => ({ signUpAction: vi.fn() }));

import { fireEvent, render, screen, waitFor } from "@/test/dom-render";
import { RegisterForm } from "./register-form";

const NAME = "Nome / Nick";
const EMAIL = "E-mail";
const PASSWORD = "Senha";

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function alertText(): string | null {
  return document.querySelector('[role="alert"]')?.textContent ?? null;
}

/**
 * O form usa `mode: "onTouched"`, entao o resolver so roda depois do blur:
 * digitar sozinho nao valida. Este helper faz a interacao de verdade.
 */
async function typeAndBlur(label: string, value: string): Promise<HTMLInputElement> {
  const el = field(label);
  fireEvent.change(el, { target: { value } });
  fireEvent.blur(el);
  return el;
}

describe("RegisterForm — erro de campo no DOM real", () => {
  it("nao mostra erro nem marca aria-invalid antes de qualquer interacao", () => {
    render(<RegisterForm />);

    expect(alertText()).toBe(null);
    for (const label of [NAME, EMAIL, PASSWORD]) {
      expect(field(label).getAttribute("aria-invalid"), label).toBe("false");
    }
  });

  it("revela o erro do campo nome no blur e liga o input via aria-describedby", async () => {
    render(<RegisterForm />);

    const name = await typeAndBlur(NAME, "a");

    await waitFor(() => expect(alertText()).toBe("Nome muito curto"));
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(name.getAttribute("aria-describedby")).toBe("name-error");
    expect(document.getElementById("name-error")?.getAttribute("role")).toBe("alert");
  });

  it("limpa o erro do campo nome assim que o valor passa a ser valido", async () => {
    render(<RegisterForm />);
    const name = await typeAndBlur(NAME, "a");
    await waitFor(() => expect(alertText()).toBe("Nome muito curto"));

    fireEvent.change(name, { target: { value: "Ana Silva" } });

    await waitFor(() => expect(alertText()).toBe(null));
    expect(name.getAttribute("aria-invalid")).toBe("false");
    expect(name.getAttribute("aria-describedby")).toBe(null);
  });

  it("revela o erro do campo email sem marcar os demais campos", async () => {
    render(<RegisterForm />);

    await typeAndBlur(EMAIL, "ana@@ex");

    await waitFor(() => expect(alertText()).toBe("E-mail inválido"));
    expect(field(EMAIL).getAttribute("aria-invalid")).toBe("true");
    expect(field(NAME).getAttribute("aria-invalid")).toBe("false");
    expect(field(PASSWORD).getAttribute("aria-invalid")).toBe("false");
  });

  it("revela o erro do campo senha", async () => {
    render(<RegisterForm />);

    await typeAndBlur(PASSWORD, "1234567");

    await waitFor(() => expect(alertText()).toBe("Senha deve ter no mínimo 8 caracteres"));
    expect(field(PASSWORD).getAttribute("aria-invalid")).toBe("true");
  });
});
