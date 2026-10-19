// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/dom-render";

// ponytail: o sino dispara server actions no mount; este teste e sobre o
// LAYOUT do header (quem esta logado ve o que), nao sobre o sino. Mockar as
// actions isola o modulo — sem isso, o `headers()` de uma action real
// estoura fora de contexto de request.
vi.mock("@/presentation/actions/notification-actions", () => ({
  getUnreadCountAction: vi.fn(async () => 0),
  listRecentNotificationsAction: vi.fn(async () => []),
  markAllAsReadAction: vi.fn(async () => {}),
  markManyAsReadAction: vi.fn(async () => {}),
}));

import { AppHeader } from "./app-header";

// ponytail: estes dois testes travam o defeito que os motivou: o header
// publico mostrava "Entrar/Criar conta" para quem JА estava logado, e nao
// oferecia nem caminho de volta ao painel nem saida. Os dois ramos sao o
// contrato visivel de "sessao" — e o anonimo e o que o
// `native-button-semantics.test.tsx` nao cobre por renderizar so um deles.
describe("AppHeader — ramo da sessão", () => {
  it("logado: saudação, atalho ao painel e Sair; sem 'Entrar'/'Criar conta'", () => {
    render(<AppHeader userName="Ana" />);

    expect(screen.getByText("Olá, Ana")).toBeTruthy();
    // ponytail: o `Button` do DS com `render={<Link/>}` expoe `role="button"`
    // (semantica do Base UI, padrao em todo o app) — o destino navega via
    // `href`, mas o papel acessivel e botao.
    const painel = screen.getByRole("button", { name: /painel/i });
    expect(painel.getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("button", { name: "Sair" })).toBeTruthy();

    expect(screen.queryByText("Entrar")).toBeNull();
    expect(screen.queryByText("Criar conta")).toBeNull();
  });

  it("anônimo: 'Entrar' e 'Criar conta'; sem saudação, 'Painel' ou 'Sair'", () => {
    render(<AppHeader />);

    expect(screen.getByText("Entrar")).toBeTruthy();
    expect(screen.getByText("Criar conta")).toBeTruthy();

    expect(screen.queryByText(/Olá,/)).toBeNull();
    expect(screen.queryByRole("button", { name: /painel/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
  });
});
