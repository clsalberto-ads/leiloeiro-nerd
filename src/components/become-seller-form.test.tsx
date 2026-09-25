import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

// ponytail: o become-seller-form importa a server action real, que arrasta
// drizzle, pg e better-auth para dentro do grafo de import do teste. A factory
// enumera so `becomeSellerAction`, que e o unico export que o form importa.
vi.mock("@/presentation/actions/profile-actions", () => ({ becomeSellerAction: vi.fn() }));

import { BecomeSellerForm } from "./become-seller-form";

function tagOf(html: string, id: string): string {
  const tag = html.match(new RegExp(`<[a-z]+[^>]*\\sid="${id}"[^>]*>`))?.[0];
  expect(tag, `nenhuma tag com id="${id}" no HTML renderizado`).toBeDefined();
  return tag!;
}

describe("BecomeSellerForm", () => {
  it("rotula o campo de slug e registra o input no RHF pelo mesmo id", () => {
    const html = renderToString(<BecomeSellerForm />);
    expect(html).toContain("Slug da vitrine");
    expect(html.match(/for="([^"]+)"[^>]*>Slug da vitrine/)?.[1]).toBe("slug");
    const input = tagOf(html, "slug");
    expect(input).toContain('name="slug"');
    expect(input).toContain('placeholder="nerd-colecionaveis"');
  });

  it("rotula o seletor de papel, registra no RHF e mantem Leilao como padrao", () => {
    const html = renderToString(<BecomeSellerForm />);
    expect(html).toContain("Ativar como");
    const select = tagOf(html, "role");
    expect(select).toContain('name="role"');
    expect(html).toContain('<option value="seller" selected="">Leiloeiro</option>');
    expect(html).toContain('<option value="both">Leiloeiro e arrematante</option>');
  });

  it("liga os inputs ao Field com aria-invalid e sem erro antes de interagir", () => {
    const html = renderToString(<BecomeSellerForm />);
    expect(tagOf(html, "slug")).toContain('aria-invalid="false"');
    expect(tagOf(html, "role")).toContain('aria-invalid="false"');
    expect(html).not.toContain('id="slug-error"');
    expect(html).not.toContain('id="role-error"');
  });

  it("nao mostra a pre-visualizacao de slug com o campo vazio", () => {
    const html = renderToString(<BecomeSellerForm />);
    expect(html).not.toContain("leiloeironerd.com/");
  });

  it("mantem o botao de ativacao", () => {
    expect(renderToString(<BecomeSellerForm />)).toContain("Ativar conta de leiloeiro");
  });
});
