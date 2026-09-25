import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { zodResolver } from "@hookform/resolvers/zod";

vi.mock("@/presentation/actions/auth-actions", () => ({ signUpAction: vi.fn() }));

import { RegisterForm } from "./register-form";
import { signUpSchema } from "@/lib/validators";

// ponytail: o resolver e testado direto porque o repo roda em node puro (sem jsdom/RTL) e o useActionState nao injeta state no renderToString; subir para asserção de UI (mensagem no Field) exige ambiente DOM.
const NO_FIELDS = { fields: {}, shouldUseNativeValidation: false };

const FIELDS = [
  { id: "name", label: "Nome / Nick" },
  { id: "email", label: "E-mail", type: "email" },
  { id: "password", label: "Senha", type: "password" },
] as const;

function tagOf(html: string, id: string): string {
  const tag = html.match(new RegExp(`<input[^>]*\\sid="${id}"[^>]*>`))?.[0];
  expect(tag, `nenhum input com id="${id}" no HTML renderizado`).toBeDefined();
  return tag!;
}

describe("RegisterForm", () => {
  it("rótulos associados aos inputs", () => {
    const html = renderToString(<RegisterForm />);
    expect(html).toContain('for="name"');
    expect(html).toContain('for="email"');
    expect(html).toContain('for="password"');
  });

  it("cada rótulo aponta para o input do mesmo campo, que envia o name certo", () => {
    const html = renderToString(<RegisterForm />);
    for (const field of FIELDS) {
      const label = html.match(new RegExp(`<label[^>]*for="${field.id}"[^>]*>([^<]*)</label>`));
      expect(label?.[1], `rótulo com for="${field.id}"`).toBe(field.label);
      const input = tagOf(html, field.id);
      expect(input).toContain(`name="${field.id}"`);
      if ("type" in field) expect(input).toContain(`type="${field.type}"`);
      expect(input).toContain('required=""');
    }
  });

  it("renderiza exatamente os três campos do cadastro", () => {
    const html = renderToString(<RegisterForm />);
    expect(html.match(/<input[^>]*>/g) ?? []).toHaveLength(FIELDS.length);
  });

  it("marca os inputs com o estado do Field e não mostra erro antes de enviar", () => {
    const html = renderToString(<RegisterForm />);
    for (const field of FIELDS) {
      expect(tagOf(html, field.id)).toContain('aria-invalid="false"');
    }
    expect(html).not.toContain('role="alert"');
  });
});

describe("signUpSchema (contrato de validação do form)", () => {
  it("entrega ao Field a mensagem pt-BR do campo inválido, e nada nos demais", async () => {
    const result = await zodResolver(signUpSchema)(
      { name: "a", email: "a@b.com", password: "12345678" },
      undefined,
      NO_FIELDS,
    );
    expect(Object.keys(result.errors)).toEqual(["name"]);
    expect(result.errors).toMatchObject({ name: { message: "Nome muito curto" } });
  });

  it("não produz erro para entrada válida", async () => {
    const result = await zodResolver(signUpSchema)(
      { name: "Ana Silva", email: "ana@ex.com", password: "senha12345" },
      undefined,
      NO_FIELDS,
    );
    expect(result.errors).toEqual({});
  });
});
