// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// ponytail: o register-form importa a server action real, que arrasta
// better-auth, drizzle e pg para dentro do grafo de import. O mock mantem o
// harness DOM isolado de banco — o escopo aqui e a validacao client-side do RHF.
//
// ponytail: a factory enumera so o que o componente importa hoje. Qualquer
// outro export de `auth-actions` fica `undefined` em runtime em vez de estourar
// — quem escrever o proximo teste DOM de outro form tem que enumerar TODOS os
// exports que a cadeia de import do componente toca, senao o `undefined` so
// aparece como "is not a function" no meio da renderizacao.
vi.mock("@/presentation/actions/auth-actions", () => ({ signUpAction: vi.fn() }));

import { fireEvent, render, screen, waitFor } from "@/test/dom-render";
import { RegisterForm } from "./register-form";

const NAME = "Nome / Nick";
const EMAIL = "E-mail";
const PASSWORD = "Senha";

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

// ponytail: escopo por campo (`[id$="-error"]`, o id que `Field` monta em
// `field.tsx`), e nao `[role="alert"]` cru: o proprio register-form renderiza
// um `<p role="alert">` de form (`state.error`) ANTES dos campos, entao o
// primeiro match em document order seria o alerta de form e todo assertion de
// campo passaria a ler o elemento errado — silenciosamente, ja que o mock da
// action nunca popula `state.error`. Aqui o alvo e sempre o erro de campo.
function alertText(): string | null {
  return document.querySelector('[role="alert"][id$="-error"]')?.textContent ?? null;
}

/**
 * ponytail: O form usa `mode: "onTouched"`, entao o resolver so roda depois do
 * blur: digitar sozinho nao valida. Este helper faz a interacao de verdade.
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
