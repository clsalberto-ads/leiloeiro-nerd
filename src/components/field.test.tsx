import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Field } from "./field";

describe("Field", () => {
  it("vincula a mensagem de erro ao input via aria-describedby", () => {
    const html = renderToString(
      <Field id="title" label="Título" error="Título deve ter no mínimo 3 caracteres">
        {(p) => <input {...p} name="title" />}
      </Field>,
    );
    expect(html).toContain('for="title"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="title-error"');
    expect(html).toContain('id="title-error"');
    expect(html).toContain('role="alert"');
  });

  it("não marca aria-invalid quando não há erro", () => {
    const html = renderToString(
      <Field id="title" label="Título">{(p) => <input {...p} name="title" />}</Field>,
    );
    expect(html).not.toContain('aria-invalid="true"');
  });
});
