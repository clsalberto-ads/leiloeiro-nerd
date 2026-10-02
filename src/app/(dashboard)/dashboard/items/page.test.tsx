import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "@/domain/repositories/item-repository";
import ItemsPage from "./page";
import { ItemsUrl } from "./items-list";
import { BecomeSellerForm } from "@/components/become-seller-form";
import { DEFAULT_TABLE_VIEW } from "./dashboard-table-state";

// ponytail: o `redirect` e mockado LANÇANDO, e nao devolvendo `undefined`. A
// documentacao do Next e explicita ("redirect throws an error") e o codigo real
// interrompe a renderizacao ali; um mock que so registrasse o destino deixaria a
// pagina continuar ate o `return` e o teste passaria com uma pagina que renderiza
// o que nao deveria. Lancar mantem o fluxo igual ao de producao.
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
  };
});

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (target: string): never => {
    spy.targets.push(target);
    throw new spy.Redirect(target);
  },
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/presentation/actions/auth-actions", () => ({
  getSession: spy.session,
}));

vi.mock("@/infrastructure/database/repositories/drizzle-item-repository", () => ({
  drizzleItemRepository: { listBySellerId: spy.list },
}));

const ITEM: Item = {
  id: "i1",
  sellerId: "u1",
  title: "Console retrô",
  description: "Console retrô completo com caixa, manuais e dois controles.",
  type: "product",
  imageUrl: "https://cdn.exemplo.test/console.webp",
  minInitialBid: 123456,
  minBidIncrement: 500,
  bidDeadline: new Date("2026-10-01T12:00:00Z"),
  paymentDeadlineDays: 3,
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T00:00:00Z"),
};

// ponytail: as props sao montadas pelo TIPO da pagina, e nao por uma copia escrita
// aqui. O Next 16 tipa `searchParams` (e `params`) como PROMESSA, e um
// `Awaited<...>`/`infer` esconderia a promessa em vez de resolve-la: o teste
// passaria um objeto puro, `await searchParams` numa pagina real devolveria o
// objeto, e o `.then` faltando so apareceria em producao. Montar o objeto inteiro
// tambem cobre o `params`, que o `PageProps` exige mesmo nesta rota sem parametro
// — e a alternativa (so `searchParams`) seria um `as` que apaga justamente o que o
// compilador tem a dizer sobre o formato da chamada.
type PageProps = Parameters<typeof ItemsPage>[0];

function propsOf(values: Record<string, string | string[]>): PageProps {
  return { params: Promise.resolve({}), searchParams: Promise.resolve(values) };
}

function asSession(role: "seller" | "both" | "buyer") {
  spy.session.mockResolvedValue({ user: { id: "u1", role, name: "Ana", email: "ana@exemplo.test" } });
}

function withResult(items: Item[], total: number) {
  spy.list.mockResolvedValue({ items, total });
}

// ponytail: a arvore e lida por TIPO, nao por posicao. `find` por `type` sobrevive a
// um `div` a mais no meio do layout, enquanto `children[3].props` quebraria com
// qualquer embrulho novo — e o teste que deveria travar o contrato da pagina
// passaria a travar o JSX dela tambem.
function achar(no: ReactNode, tipo: unknown): ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(no)) {
    for (const filho of no) {
      const achado = achar(filho, tipo);
      if (achado) return achado;
    }
    return undefined;
  }
  if (!isValidElement(no)) return undefined;
  const element = no as ReactElement<Record<string, unknown>>;
  if (element.type === tipo) return element;
  return achar(element.props.children as ReactNode, tipo);
}

async function renderPage(values: Record<string, string | string[]>) {
  const element = await ItemsPage(propsOf(values));
  return { element, table: achar(element, ItemsUrl) };
}

async function redirectTarget(values: Record<string, string | string[]>): Promise<string> {
  try {
    await ItemsPage(propsOf(values));
  } catch (error) {
    if (error instanceof spy.Redirect) return error.target;
    throw error;
  }
  throw new Error("a página não redirecionou");
}

beforeEach(() => {
  spy.targets.length = 0;
  spy.session.mockReset();
  spy.list.mockReset();
  asSession("seller");
  withResult([ITEM], 1);
});

describe("items/page — a URL como estado da tela", () => {
  it("abre na primeira página do mais recente para o mais antigo", async () => {
    const { table } = await renderPage({});

    expect(spy.list).toHaveBeenCalledWith("u1", {
      orderBy: "createdAt",
      direction: "desc",
      limit: 10,
      offset: 0,
    });
    expect(table?.props.view).toEqual(DEFAULT_TABLE_VIEW);
    expect(table?.props.totalCount).toBe(1);
  });

  // ponytail: o filtro e o unico lugar onde a URL vira SQL, entao o teste compara o
  // objeto INTEIRO, sem `expect.objectContaining`. Um `objectContaining` passaria
  // com um `q` ou um `status` sobrando do parametro anterior — que e o bug exato
  // de "a busca continua filtrando depois que eu limpei o campo".
  it("manda a busca, a aba, a coluna e o deslocamento para a consulta", async () => {
    const { table } = await renderPage({
      q: "console",
      status: "active",
      orderBy: "minInitialBid",
      direction: "desc",
      page: "3",
      pageSize: "20",
    });

    expect(spy.list).toHaveBeenCalledWith("u1", {
      q: "console",
      status: "active",
      orderBy: "minInitialBid",
      direction: "desc",
      limit: 20,
      offset: 40,
    });
    expect(table?.props.view).toEqual({
      q: "console",
      status: "active",
      orderBy: "minInitialBid",
      direction: "desc",
      page: 3,
      pageSize: 20,
    });
  });

  it("consulta com a busca aparada, e não com o que veio na barra", async () => {
    await renderPage({ q: "  console  " });

    expect(spy.list).toHaveBeenCalledWith("u1", {
      q: "console",
      orderBy: "createdAt",
      direction: "desc",
      limit: 10,
      offset: 0,
    });
  });

  it("usa o primeiro valor quando o parâmetro vem repetido", async () => {
    await renderPage({ page: ["2", "9"] });

    expect(spy.list).toHaveBeenCalledWith("u1", expect.objectContaining({ offset: 10 }));
  });

  it("entrega só os seis campos do DTO para o componente cliente", async () => {
    const { table } = await renderPage({});

    const items = table?.props.items as Record<string, unknown>[];
    expect(items).toHaveLength(1);
    expect(Object.keys(items[0]).sort()).toEqual([
      "bidDeadline",
      "id",
      "minInitialBid",
      "status",
      "title",
      "type",
    ]);
  });

  it("renderiza a lista com o que veio do repositório", async () => {
    const { element } = await renderPage({});
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Console retrô");
    expect(html).toContain("/dashboard/items/new");
  });
});

describe("items/page — a página fora do fim", () => {
  it("corrige para a última página, preservando o filtro", async () => {
    withResult([], 30);

    const target = await redirectTarget({
      q: "console",
      orderBy: "minInitialBid",
      page: "99",
      pageSize: "20",
    });

    // 30 itens de 20 em 20 = página 2; o filtro continua, só o número da página some.
    expect(target).toBe("/dashboard/items?q=console&orderBy=minInitialBid&page=2&pageSize=20");
  });

  it("volta para a primeira página quando o filtro não achou nada", async () => {
    withResult([], 0);

    expect(await redirectTarget({ q: "nada", page: "4" })).toBe(
      "/dashboard/items?q=nada",
    );
  });

  // ponytail: a primeira página vazia NÃO redireciona. Mandar o usuário para a
  // própria página 1 criaria uma entrada a toa no histórico e o "voltar" do
  // navegador pareceria quebrado — a URL não muda, o conteúdo não muda, mas o
  // histórico cresce. Tela vazia é resposta válida de um filtro sem resultado.
  it("deixa a primeira página vazia como está, sem mexer no histórico", async () => {
    withResult([], 0);

    const { element } = await renderPage({ q: "nada" });

    expect(spy.targets).toEqual([]);
    expect(renderToStaticMarkup(element)).toContain("Nenhum item encontrado");
  });
});

describe("items/page — quem não tem lista", () => {
  it("não consulta o repositório para quem não é leiloeiro", async () => {
    asSession("buyer");

    const { element, table } = await renderPage({});

    expect(spy.list).not.toHaveBeenCalled();
    expect(table).toBeUndefined();
    expect(achar(element, BecomeSellerForm)).toBeDefined();
  });

  it("não renderiza nada sem sessão", async () => {
    spy.session.mockResolvedValue(null);

    expect(await ItemsPage(propsOf({}))).toBeNull();
    expect(spy.list).not.toHaveBeenCalled();
  });
});
