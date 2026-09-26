import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToPipeableStream } from "react-dom/server";
import type { ReactElement } from "react";

const espiao = vi.hoisted(() => {
  class NaoEncontrado extends Error {}
  return {
    NaoEncontrado,
    vendedor: vi.fn(),
    itens: vi.fn(),
  };
});

// ponytail: o `notFound()` e mockado LANÇANDO, pelo mesmo motivo do
// `items/page.test.tsx` — o codigo real interrompe a renderizacao ali, e um mock
// que so registrasse o slug deixaria a pagina continuar e o teste passaria com uma
// vitrine de vendedor inexistente na tela.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: (): never => {
    throw new espiao.NaoEncontrado();
  },
}));

vi.mock("@/presentation/actions/public-actions", () => ({
  getVitrineSellerAction: espiao.vendedor,
  listVitrineItemsAction: espiao.itens,
}));

import VitrinePage from "./page";
import type { Item } from "@/domain/repositories/item-repository";

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "i1",
    sellerId: "u1",
    title: "Console retrô",
    description: "Completo.",
    type: "product",
    imageUrl: null,
    minInitialBid: 5000,
    minBidIncrement: 500,
    bidDeadline: new Date("2026-10-01T12:00:00Z"),
    paymentDeadlineDays: 3,
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-02-01T00:00:00Z"),
    ...overrides,
  };
}

type PropsDaPagina = Parameters<typeof VitrinePage>[0];

function props(slug: string): PropsDaPagina {
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
function streamar(elemento: ReactElement) {
  const partes: string[] = [];
  const erros: string[] = [];
  let acorda!: () => void;
  const primeiroFlush = new Promise<string>((resolve) => {
    acorda = () => resolve(partes[0] ?? "");
  });
  const fim = new Promise<string[]>((resolve) => {
    const saida = new PassThrough();
    saida.setEncoding("utf8");
    saida.on("data", (pedaco: string) => {
      partes.push(pedaco);
      acorda();
    });
    saida.on("end", () => resolve(partes));
    const { pipe } = renderToPipeableStream(elemento, {
      onShellReady() {
        pipe(saida);
      },
      onError(erro) {
        erros.push(String(erro));
      },
      // ponytail: o `onShellError` e o que impede um erro no shell de virar a MESMA
      // espera silenciosa de "nada suspendeu". Sem ele o `pipe` nunca e chamado, o
      // fluxo nao produz chunk nenhum e a falha se apresenta como travamento.
      onShellError(erro) {
        erros.push(String(erro));
      },
    });
  });
  return { partes, erros, primeiroFlush, fim };
}

// ponytail: o prazo existe porque o modo de falha natural desta fronteira e a
// ESPERA, nao a asercao. Medido: com o `await` da listagem de volta no corpo da
// pagina (a fronteira na posicao decorativa do plano), o `await VitrinePage(...)`
// nao resolve enquanto a listagem nao responde — e a listagem so responde DEPOIS
// do primeiro flush, que so vem DEPOIS do `await VitrinePage(...)`. Sem este
// prazo o teste morre no timeout de 5s do vitest, que se le como "teste lento" e
// nao como "a fronteira parou de esperar". O `erros` entra na mensagem porque o
// outro caminho para o mesmo silencio e um erro no shell.
const PRAZO_MS = 2000;

async function antesDoPrazo<T>(oQue: string, promessa: Promise<T>, erros: string[] = []): Promise<T> {
  let relogio!: ReturnType<typeof setTimeout>;
  const prazo = new Promise<never>((_, rejeita) => {
    relogio = setTimeout(
      () =>
        rejeita(
          new Error(
            `a vitrine nao entregou ${oQue} em ${PRAZO_MS}ms${erros.length > 0 ? ` — erros: ${erros.join(" | ")}` : ""}`,
          ),
        ),
      PRAZO_MS,
    );
  });
  try {
    return await Promise.race([promessa, prazo]);
  } finally {
    clearTimeout(relogio);
  }
}

// ponytail: o React separa texto estatico de dinamico com `<!-- -->` no HTML do
// servidor (`Vitrine de <!-- -->Ana`), entao comparar a frase inteira no HTML
// bruto falharia por um detalhe de serializacao, nao por falta do nome.
function texto(html: string): string {
  return html.replaceAll("<!-- -->", "");
}

const VENDEDOR = { id: "u1", name: "Ana", slug: "ana" };

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
    espiao.vendedor.mockResolvedValue(VENDEDOR);
    let chega!: (valor: Item[]) => void;
    espiao.itens.mockReturnValue(new Promise<Item[]>((resolve) => { chega = resolve; }));

    const elemento = await antesDoPrazo("o shell", VitrinePage(props("ana")));
    const fluxo = streamar(elemento);

    const primeiro = await antesDoPrazo("o primeiro flush", fluxo.primeiroFlush, fluxo.erros);
    chega([item()]);
    const partes = await antesDoPrazo("o conteudo", fluxo.fim, fluxo.erros);

    expect(fluxo.erros).toEqual([]);
    // ponytail: o titulo fica FORA da fronteira, e e ele que faz o esqueleto
    // aparecer. Medido nesta suite: uma fronteira sozinha, sem nada em volta,
    // recebe `onShellReady` sem nunca despejar o fallback — o React espera e
    // entrega o conteudo pronto num unico flush. Sem o `<h1>` no shell, o
    // primeiro flush seria o dos cards e este teste acusaria.
    expect(texto(primeiro)).toContain("Vitrine de Ana");
    expect(primeiro).toContain('data-slot="item-card-skeleton"');
    expect(texto(primeiro)).not.toContain("Console retrô");

    expect(partes.join("")).toContain("Console retrô");
    expect(espiao.itens).toHaveBeenCalledWith("u1");
  });

  // ponytail: a fronteira e um placeholder, nao um manto. O esqueleto SAI no
  // primeiro flush (a promessa ja estava resolvida e mesmo assim o React
  // suspende o filho, porque promessa resolvida nao e promessa sincrona) e o
  // estado vazio chega depois. E o ULTIMO flush que diz o que fica na tela: um
  // esqueleto que continuasse ali seria a vitrine mostrando duas coisas ao mesmo
  // tempo, e o usuario nunca saberia qual delas e a dele.
  it("a vitrine sem itens termina no estado vazio, sem esqueleto", async () => {
    espiao.vendedor.mockResolvedValue(VENDEDOR);
    espiao.itens.mockResolvedValue([]);

    const elemento = await antesDoPrazo("o shell", VitrinePage(props("ana")));
    const partes = await antesDoPrazo("o fim do fluxo", streamar(elemento).fim);
    const ultimo = partes[partes.length - 1] ?? "";

    expect(texto(partes.join(""))).toContain('data-slot="empty-state"');
    expect(texto(partes.join(""))).toContain("Nenhum item em leilão");
    expect(ultimo).not.toContain('data-slot="item-card-skeleton"');
    expect(ultimo).toContain('data-slot="empty-state"');
  });

  // ponytail: o 404 e decidido no SHELL, antes de qualquer flush, e e por isso que
  // a vitrine foi partida (o `notFound()` precisa do vendedor, e o vendedor vem
  // da mesma acao que trazia os itens). Se o `notFound()` morasse dentro da
  // fronteira, ele rodaria DEPOIS do primeiro flush: a resposta ja estaria com
  // status 200 e uma vitrine publica errada sairia como pagina valida. Este `it`
  // trava essa ordem — e trava tambem que a listagem nem chega a rodar.
  it("slug inexistente responde 404 sem chegar a listar itens", async () => {
    espiao.vendedor.mockResolvedValue(null);
    espiao.itens.mockResolvedValue([]);

    await expect(VitrinePage(props("ninguem"))).rejects.toBeInstanceOf(espiao.NaoEncontrado);
    expect(espiao.itens).not.toHaveBeenCalled();
  });
});
