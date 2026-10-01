import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), redirect: vi.fn() }));

vi.mock("@/presentation/actions/auth-actions", () => ({ getSession: mocks.sessao, signOutAction: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: mocks.redirect,
}));

import DashboardLayout from "./layout";

const SESSAO = { user: { id: "u1", name: "Ana", email: "ana@ex.com", role: "seller" } };

function contar(html: string, tag: string) {
  return html.match(new RegExp(`<${tag}[\\s>]`, "g"))?.length ?? 0;
}

async function renderizar() {
  return renderToStaticMarkup(await DashboardLayout({ children: <p>conteudo</p> }));
}

// ponytail: o shell do dashboard e o unico lugar onde header, sidebar e container
// se encontram — nenhuma pagina tem acesso a ele. Se um `<header>`/`<main>` extra
// entrar aqui (ou sumir), DUAS paginas quebram de uma vez e nenhum teste de
// pagina acusa. Estes tres casos travam o invariante sem fixar string de Tailwind:
// a classe muda a cada ajuste de layout, a estrutura nao.
describe("dashboard/layout — o shell unificado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessao.mockResolvedValue(SESSAO);
    // o `redirect` de verdade LANCA (NEXT_REDIRECT) e nao devolve: um mock que
    // apenas registra deixaria o layout seguir para `session.user.name` e o
    // teste passaria a testar o mock, nao o guard.
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  it("monta exatamente um header e um main em volta das paginas", async () => {
    const html = await renderizar();

    expect(contar(html, "header")).toBe(1);
    expect(contar(html, "main")).toBe(1);
    expect(html).toContain("conteudo");
  });

  it("a sidebar expoe os tres destinos do dashboard", async () => {
    const html = await renderizar();

    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/dashboard/items"');
    expect(html).toContain('href="/dashboard/settings"');
  });

  // ponytail: o guard e a unica coisa entre um visitante e o painel com os lances
  // dos outros. Sem sessao, `redirect` precisa ter sido chamado.
  it("sem sessao manda para o login", async () => {
    mocks.sessao.mockResolvedValue(null);

    await expect(renderizar()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});
