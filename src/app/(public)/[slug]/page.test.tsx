import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToPipeableStream } from "react-dom/server";
import type { ReactElement } from "react";

const spy = vi.hoisted(() => {
  class NotFound extends Error {}
  return {
    NotFound,
    seller: vi.fn(),
    items: vi.fn(),
  };
});

// ponytail: o `notFound()` e mockado LANÇANDO, pelo mesmo motivo do
// `items/page.test.tsx` — o codigo real interrompe a renderizacao ali, e um mock
// que so registrasse o slug deixaria a pagina continuar e o teste passaria com uma
// vitrine de vendedor inexistente na tela.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: (): never => {
    throw new spy.NotFound();
  },
}));

vi.mock("@/presentation/actions/public-actions", () => ({
  getStorefrontSellerAction: spy.seller,
  listStorefrontItemsAction: spy.items,
}));

import StorefrontPage from "./page";
import type { StorefrontItem } from "@/domain/repositories/item-repository";

function item(overrides: Partial<StorefrontItem> = {}): StorefrontItem {
  return {
    id: "i1",
    title: "Console retrô",
    type: "product",
    imageUrl: null,
    minInitialBid: 5000,
    bidDeadline: new Date("2026-10-01T12:00:00Z"),
    totalBids: 0,
    highestBid: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

type PageProps = Parameters<typeof StorefrontPage>[0];

function props(slug: string): PageProps {
  return { params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) };
}

// ponytail: `renderToPipeableStream` e o renderizador que o Next usa, e e o
// unico dos tres que distingue "a fronteira despejou o esqueleto" de "a
// fronteira nunca teve nada para esperar". Medido nesta suite com um filho que
// suspende: `renderToStaticMarkup` e `renderToString` NENHUM dos dois lanca
// nada e os dois servem o FALLBACK — o `renderToString` ainda embrulha a
// fronteira em `<!--$!-->` com um `data-msg` de "switched to client rendering
// because the server rendering aborted", ou seja, o conteudo simplesmente nao
// existe no HTML do servidor e a recuperacao (se houver) acontece no cliente.
// Nos dois, um teste de "o esqueleto aparece" escrito assim passaria na posicao
// decorativa: seria um teste que nao prova nada.
function streamar(element: ReactElement) {
  const parts: string[] = [];
  const errors: string[] = [];
  let wake!: () => void;
  // ponytail: `firstFlush` espera o FIM DO SHELL, e nao o primeiro `data` do
  // stream. Sao coisas diferentes, e a distincao e o que faz este teste medir o que
  // o nome diz. O React pode partir o shell em VARIOS chunks — medido nesta suite:
  // com o hero e os controles no shell, o primeiro chunk sao 1.532 bytes e termina
  // no meio do `class` de um `<button>`, sem fronteira nenhuma. Resolver no
  // primeiro `data` media CHUNK, nao FLUSH, e o teste passava aNtES por motivo
  // errado: o shell antigo cabia inteiro num chunk, entao as duas coisas
  // coincidiam e ninguem via o bug.
  //
  // O marcador do fim do shell e o `<!--/$-->` que o React fecha depois de todo
  // fallback. Ele vem DEPOIS do esqueleto, entao espera-lo mede o shell completo —
  // e o que separa o fallback do conteudo que sobe depois. Se a fronteira nao
  // fechar, o `end` resolve assim mesmo, para o caso virar uma falha com mensagem
  // em vez de um travamento.
  const firstFlush = new Promise<string>((resolve) => {
    wake = () => {
      if (parts.join("").includes("<!--/$-->")) resolve(parts.join(""));
    };
  });
  const end = new Promise<string[]>((resolve) => {
    const output = new PassThrough();
    output.setEncoding("utf8");
    output.on("data", (chunk: string) => {
      parts.push(chunk);
      wake();
    });
    output.on("end", () => {
      wake();
      resolve(parts);
    });
    const { pipe } = renderToPipeableStream(element, {
      onShellReady() {
        pipe(output);
      },
      onError(error) {
        errors.push(String(error));
      },
      // ponytail: o `onShellError` e o que impede um erro no shell de virar a MESMA
      // espera silenciosa de "nada suspendeu". Sem ele o `pipe` nunca e chamado, o
      // fluxo nao produz chunk nenhum e a falha se apresenta como travamento.
      onShellError(error) {
        errors.push(String(error));
      },
    });
  });
  return { parts, errors, firstFlush, end };
}

// ponytail: o prazo existe porque o modo de falha natural desta fronteira e a
// ESPERA, nao a asercao. Medido: com o `await` da listagem de volta no corpo da
// pagina (a fronteira na posicao decorativa do plano), o `await VitrinePage(...)`
// nao resolve enquanto a listagem nao responde — e a listagem so responde DEPOIS
// do primeiro flush, que so vem DEPOIS do `await VitrinePage(...)`. Sem este
// prazo o teste morre no timeout de 5s do vitest, que se le como "teste lento" e
// nao como "a fronteira parou de esperar". O `erros` entra na mensagem porque o
// outro caminho para o mesmo silencio e um erro no shell.
const DEADLINE_MS = 2000;

async function beforeDeadline<T>(what: string, promise: Promise<T>, errors: string[] = []): Promise<T> {
  let timer!: ReturnType<typeof setTimeout>;
  const prazo = new Promise<never>((_, rejeita) => {
    timer = setTimeout(
      () =>
        rejeita(
          new Error(
            `a vitrine nao entregou ${what} em ${DEADLINE_MS}ms${errors.length > 0 ? ` — erros: ${errors.join(" | ")}` : ""}`,
          ),
        ),
      DEADLINE_MS,
    );
  });
  try {
    return await Promise.race([promise, prazo]);
  } finally {
    clearTimeout(timer);
  }
}

// ponytail: o React separa texto estatico de dinamico com `<!-- -->` no HTML do
// servidor (`Vitrine de <!-- -->Ana`), entao comparar a frase inteira no HTML
// bruto falharia por um detalhe de serializacao, nao por falta do nome.
function text(html: string): string {
  return html.replaceAll("<!-- -->", "");
}

// ponytail: o `vendedor` grew porque a action trocou de porta: `getSellerBySlug`
// devolvia `{id, name, slug}` e o HERO precisa de `image`, `createdAt` e
// `activeItemCount`. Os tres `it` nao mudaram de intencao — o que mudou foi a
// forma do dado que o spy devolve.
const SELLER = {
  id: "u1",
  name: "Ana",
  slug: "ana",
  image: null,
  createdAt: new Date("2026-01-15T12:00:00Z"),
  activeItemCount: 1,
};

// ponytail: os espioes sao zerados entre os `it` porque o `it` do 404 afirma que a
// listagem NAO chega a rodar — e um spy que carrega as chamadas do teste anterior
// acusaria essa ausencia como se ela tivesse acontecido.
beforeEach(() => {
  vi.clearAllMocks();
});

describe("[slug]/page — o esqueleto da vitrine", () => {
  // ponytail: este `it` e a razao de a vitrine ter sido partida em duas. Uma
  // fronteira `<Suspense>` no corpo de uma pagina async so serve se ALGO abaixo
  // dela suspender — e o `await` da propria pagina acontece ANTES do JSX existir,
  // entao nada abaixo suspende, o fallback nunca aparece e o esqueleto e teatro.
  // A prova e comportamental e nao estrutural: enquanto os itens nao chegam, o
  // primeiro flush e o esqueleto; quando chegam, e o segundo.
  it("o primeiro flush é o esqueleto e os cards vêm no flush seguinte", async () => {
    spy.seller.mockResolvedValue(SELLER);
    let arrive!: (value: StorefrontItem[]) => void;
    spy.items.mockReturnValue(new Promise<StorefrontItem[]>((resolve) => { arrive = resolve; }));

    const element = await beforeDeadline("o shell", StorefrontPage(props("ana")));
    const fluxo = streamar(element);

    const first = await beforeDeadline("o primeiro flush", fluxo.firstFlush, fluxo.errors);
    arrive([item()]);
    const parts = await beforeDeadline("o conteudo", fluxo.end, fluxo.errors);

    expect(fluxo.errors).toEqual([]);
    // ponytail: o titulo fica FORA da fronteira, e e ele que faz o esqueleto
    // aparecer. Medido nesta suite: uma fronteira sozinha, sem nada em volta,
    // recebe `onShellReady` sem nunca despejar o fallback — o React espera e
    // entrega o conteudo pronto num unico flush. Sem o `<h1>` no shell, o
    // primeiro flush seria o dos cards e este teste acusaria.
    // ponytail: aqui a string "Vitrine de Ana" virou `data-slot="vitrine-hero"` +
    // "Ana", e a mudanca de conteudo e menor que a de nome. O `<h1>` saiu da PAGINA
    // e foi para o HERO (que o layout publico nao tem — la so ha um `<header>` sem
    // nome, entao continua havendo um unico `<h1>` na rota, e nenhum landmark
    // duplicado). O que este `it` continua provando e o que ele sempre provou, e o
    // que o comentario abaixo diz: o SHELL tem conteudo antes do primeiro flush, e e
    // por isso que o esqueleto aparece. O marcador do hero e a forma mais forte de
    // dizer isso — ele falha se o hero sair do shell, e a string passaria a passar
    // por acidente se o nome aparecesse em qualquer outro lugar do HTML.
    expect(first).toContain('data-slot="storefront-hero"');
    expect(text(first)).toContain("Ana");
    expect(first).toContain('data-slot="item-card-skeleton"');
    expect(text(first)).not.toContain("Console retrô");

    expect(parts.join("")).toContain("Console retrô");
    expect(spy.items).toHaveBeenCalledWith("u1", { q: "", sort: "prazo" });
  });

  // ponytail: a fronteira e um placeholder, nao um manto. O esqueleto SAI no
  // primeiro flush (a promessa ja estava resolvida e mesmo assim o React
  // suspende o filho, porque promessa resolvida nao e promessa sincrona) e o
  // estado vazio chega depois. E o ULTIMO flush que diz o que fica na tela: um
  // esqueleto que continuasse ali seria a vitrine mostrando duas coisas ao mesmo
  // tempo, e o usuario nunca saberia qual delas e a dele.
  it("a vitrine sem itens termina no estado vazio, sem esqueleto", async () => {
    spy.seller.mockResolvedValue(SELLER);
    spy.items.mockResolvedValue([]);

    const element = await beforeDeadline("o shell", StorefrontPage(props("ana")));
    const parts = await beforeDeadline("o fim do fluxo", streamar(element).end);
    const last = parts[parts.length - 1] ?? "";

    expect(text(parts.join(""))).toContain('data-slot="empty-state"');
    expect(text(parts.join(""))).toContain("Nenhum item em leilão");
    expect(last).not.toContain('data-slot="item-card-skeleton"');
    expect(last).toContain('data-slot="empty-state"');
  });

  // ponytail: o 404 e decidido no SHELL, antes de qualquer flush, e e por isso que
  // a vitrine foi partida (o `notFound()` precisa do vendedor, e o vendedor vem
  // da mesma acao que trazia os itens). Se o `notFound()` morasse dentro da
  // fronteira, ele rodaria DEPOIS do primeiro flush: a resposta ja estaria com
  // status 200 e uma vitrine publica errada sairia como pagina valida. Este `it`
  // trava essa ordem — e trava tambem que a listagem nem chega a rodar.
  it("slug inexistente responde 404 sem chegar a listar itens", async () => {
    spy.seller.mockResolvedValue(null);
    spy.items.mockResolvedValue([]);

    await expect(StorefrontPage(props("ninguem"))).rejects.toBeInstanceOf(spy.NotFound);
    expect(spy.items).not.toHaveBeenCalled();
  });
});
