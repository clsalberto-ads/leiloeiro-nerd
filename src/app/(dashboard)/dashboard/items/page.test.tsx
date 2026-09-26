import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "@/domain/repositories/item-repository";
import ItemsPage from "./page";
import { ItensDaUrl } from "./items-list";
import { BecomeSellerForm } from "@/components/become-seller-form";
import { VISTA_PADRAO } from "./estado-da-tabela";

// ponytail: o `redirect` e mockado LANÇANDO, e nao devolvendo `undefined`. A
// documentacao do Next e explicita ("redirect throws an error") e o codigo real
// interrompe a renderizacao ali; um mock que so registrasse o destino deixaria a
// pagina continuar ate o `return` e o teste passaria com uma pagina que renderiza
// o que nao deveria. Lancar mantem o fluxo igual ao de producao.
const espiao = vi.hoisted(() => {
  class Redirecionamento extends Error {
    constructor(readonly destino: string) {
      super(destino);
    }
  }
  return {
    Redirecionamento,
    destinos: [] as string[],
    sessao: vi.fn(),
    listar: vi.fn(),
  };
});

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (destino: string): never => {
    espiao.destinos.push(destino);
    throw new espiao.Redirecionamento(destino);
  },
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/presentation/actions/auth-actions", () => ({
  getSession: espiao.sessao,
}));

vi.mock("@/infrastructure/database/repositories/drizzle-item-repository", () => ({
  drizzleItemRepository: { listBySellerId: espiao.listar },
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
type PropsDaPagina = Parameters<typeof ItemsPage>[0];

function propsDe(valores: Record<string, string | string[]>): PropsDaPagina {
  return { params: Promise.resolve({}), searchParams: Promise.resolve(valores) };
}

function comoSessao(role: "seller" | "both" | "buyer") {
  espiao.sessao.mockResolvedValue({ user: { id: "u1", role, name: "Ana", email: "ana@exemplo.test" } });
}

function comResultado(items: Item[], total: number) {
  espiao.listar.mockResolvedValue({ items, total });
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
  const elemento = no as ReactElement<Record<string, unknown>>;
  if (elemento.type === tipo) return elemento;
  return achar(elemento.props.children as ReactNode, tipo);
}

async function renderDaPagina(valores: Record<string, string | string[]>) {
  const elemento = await ItemsPage(propsDe(valores));
  return { elemento, tabela: achar(elemento, ItensDaUrl) };
}

async function destinoDoRedirecionamento(valores: Record<string, string | string[]>): Promise<string> {
  try {
    await ItemsPage(propsDe(valores));
  } catch (erro) {
    if (erro instanceof espiao.Redirecionamento) return erro.destino;
    throw erro;
  }
  throw new Error("a página não redirecionou");
}

beforeEach(() => {
  espiao.destinos.length = 0;
  espiao.sessao.mockReset();
  espiao.listar.mockReset();
  comoSessao("seller");
  comResultado([ITEM], 1);
});

describe("items/page — a URL como estado da tela", () => {
  it("abre na primeira página do mais recente para o mais antigo", async () => {
    const { tabela } = await renderDaPagina({});

    expect(espiao.listar).toHaveBeenCalledWith("u1", {
      orderBy: "createdAt",
      direction: "desc",
      limit: 10,
      offset: 0,
    });
    expect(tabela?.props.vista).toEqual(VISTA_PADRAO);
    expect(tabela?.props.totalCount).toBe(1);
  });

  // ponytail: o filtro e o unico lugar onde a URL vira SQL, entao o teste compara o
  // objeto INTEIRO, sem `expect.objectContaining`. Um `objectContaining` passaria
  // com um `q` ou um `status` sobrando do parametro anterior — que e o bug exato
  // de "a busca continua filtrando depois que eu limpei o campo".
  it("manda a busca, a aba, a coluna e o deslocamento para a consulta", async () => {
    const { tabela } = await renderDaPagina({
      q: "console",
      status: "active",
      orderBy: "minInitialBid",
      direction: "desc",
      page: "3",
      pageSize: "20",
    });

    expect(espiao.listar).toHaveBeenCalledWith("u1", {
      q: "console",
      status: "active",
      orderBy: "minInitialBid",
      direction: "desc",
      limit: 20,
      offset: 40,
    });
    expect(tabela?.props.vista).toEqual({
      q: "console",
      status: "active",
      orderBy: "minInitialBid",
      direction: "desc",
      page: 3,
      pageSize: 20,
    });
  });

  it("consulta com a busca aparada, e não com o que veio na barra", async () => {
    await renderDaPagina({ q: "  console  " });

    expect(espiao.listar).toHaveBeenCalledWith("u1", {
      q: "console",
      orderBy: "createdAt",
      direction: "desc",
      limit: 10,
      offset: 0,
    });
  });

  it("usa o primeiro valor quando o parâmetro vem repetido", async () => {
    await renderDaPagina({ page: ["2", "9"] });

    expect(espiao.listar).toHaveBeenCalledWith("u1", expect.objectContaining({ offset: 10 }));
  });

  it("entrega só os seis campos do DTO para o componente cliente", async () => {
    const { tabela } = await renderDaPagina({});

    const itens = tabela?.props.items as Record<string, unknown>[];
    expect(itens).toHaveLength(1);
    expect(Object.keys(itens[0]).sort()).toEqual([
      "bidDeadline",
      "id",
      "minInitialBid",
      "status",
      "title",
      "type",
    ]);
  });

  it("renderiza a lista com o que veio do repositório", async () => {
    const { elemento } = await renderDaPagina({});
    const html = renderToStaticMarkup(elemento);

    expect(html).toContain("Console retrô");
    expect(html).toContain("/dashboard/items/new");
  });
});

describe("items/page — a página fora do fim", () => {
  it("corrige para a última página, preservando o filtro", async () => {
    comResultado([], 30);

    const destino = await destinoDoRedirecionamento({
      q: "console",
      orderBy: "minInitialBid",
      page: "99",
      pageSize: "20",
    });

    // 30 itens de 20 em 20 = página 2; o filtro continua, só o número da página some.
    expect(destino).toBe("/dashboard/items?q=console&orderBy=minInitialBid&page=2&pageSize=20");
  });

  it("volta para a primeira página quando o filtro não achou nada", async () => {
    comResultado([], 0);

    expect(await destinoDoRedirecionamento({ q: "nada", page: "4" })).toBe(
      "/dashboard/items?q=nada",
    );
  });

  // ponytail: a primeira página vazia NÃO redireciona. Mandar o usuário para a
  // própria página 1 criaria uma entrada a toa no histórico e o "voltar" do
  // navegador pareceria quebrado — a URL não muda, o conteúdo não muda, mas o
  // histórico cresce. Tela vazia é resposta válida de um filtro sem resultado.
  it("deixa a primeira página vazia como está, sem mexer no histórico", async () => {
    comResultado([], 0);

    const { elemento } = await renderDaPagina({ q: "nada" });

    expect(espiao.destinos).toEqual([]);
    expect(renderToStaticMarkup(elemento)).toContain("Nenhum item encontrado");
  });
});

describe("items/page — quem não tem lista", () => {
  it("não consulta o repositório para quem não é leiloeiro", async () => {
    comoSessao("buyer");

    const { elemento, tabela } = await renderDaPagina({});

    expect(espiao.listar).not.toHaveBeenCalled();
    expect(tabela).toBeUndefined();
    expect(achar(elemento, BecomeSellerForm)).toBeDefined();
  });

  it("não renderiza nada sem sessão", async () => {
    espiao.sessao.mockResolvedValue(null);

    expect(await ItemsPage(propsDe({}))).toBeNull();
    expect(espiao.listar).not.toHaveBeenCalled();
  });
});
