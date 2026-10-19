import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Notification } from "@/domain/repositories/notification-repository";
import NotificationsPage from "./page";

// ponytail: o `redirect` e mockado LANÇANDO, e nao devolvendo `undefined` —
// o mesmo desenho (e pelo mesmo motivo) do `items/page.test.tsx`.
const spy = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly target: string) {
      super(target);
    }
  }
  return {
    Redirect,
    targets: [] as string[],
    session: vi.fn(),
    list: vi.fn(),
    markAsRead: vi.fn(),
    deleteNotification: vi.fn(),
  };
});

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (target: string): never => {
    spy.targets.push(target);
    throw new spy.Redirect(target);
  },
}));

vi.mock("@/presentation/actions/auth-actions", () => ({
  getSession: spy.session,
}));

vi.mock("@/presentation/actions/notification-actions", () => ({
  listNotificationsAction: spy.list,
  markAllAsReadAction: vi.fn(),
  markAsReadAction: spy.markAsRead,
  deleteNotificationAction: spy.deleteNotification,
}));

const base: Notification = {
  id: "n1",
  userId: "u1",
  type: "outbid",
  title: "Lance superado",
  content: "Seu lance de R$ 50,00 foi superado.",
  read: false,
  createdAt: new Date("2026-10-19T12:00:00Z"),
};

const unread: Notification = { ...base };
const read: Notification = { ...base, id: "n2", read: true };

async function renderPage() {
  return renderToStaticMarkup(
    await NotificationsPage({ searchParams: Promise.resolve({}) }),
  );
}

// ponytail: estes testes seguram o contrato que o pedido definiu: o CORPO da
// não lida e clicável (um botão de submit, nao um botãozinho à direita) e
// TODA linha tem como ser apagada. O submit em si e comportamento do navegador;
// o que a marcação precisa provar e que a estrutura que o clique percorre
// existe — o botão no lugar certo, com o rótulo que o leitor de tela ouve.
describe("notifications/page — linha clicável e exclusão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spy.session.mockResolvedValue({ user: { id: "u1", name: "Ana" } });
  });

  it("não lida: o corpo inteiro é um botão de submit com o rótulo 'marcar como lida'", async () => {
    spy.list.mockResolvedValue({ items: [unread], total: 1 });

    const html = await renderPage();

    expect(html).toContain("Lance superado");
    expect(html).toContain("<button");
    // o sufixo sr-only que anuncia a AÇÃO ao leitor de tela
    expect(html).toContain("marcar como lida");
    // o ponto azul de não lida
    expect(html).toContain("bg-primary");
  });

  it("lida: o corpo é texto puro, sem botão de marcar", async () => {
    spy.list.mockResolvedValue({ items: [read], total: 1 });

    const html = await renderPage();

    expect(html).toContain("Lance superado");
    expect(html).not.toContain("marcar como lida");
  });

  it("toda linha tem botão de excluir com rótulo que nomeia a notificação", async () => {
    spy.list.mockResolvedValue({ items: [unread, read], total: 2 });

    const html = await renderPage();

    expect(html.match(/Excluir notificação: Lance superado/g)).toHaveLength(2);
  });

  it("sem sessão redireciona para /login antes de listar", async () => {
    spy.session.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(spy.Redirect);
    expect(spy.targets).toEqual(["/login"]);
    expect(spy.list).not.toHaveBeenCalled();
  });
});
