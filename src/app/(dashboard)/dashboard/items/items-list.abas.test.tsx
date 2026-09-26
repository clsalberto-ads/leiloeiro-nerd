import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { ItemStatus } from "@/domain/repositories/item-repository";
import { ROTULO_STATUS } from "@/domain/repositories/item-repository";

const mocks = vi.hoisted(() => ({ BidCountdown: vi.fn() }));

vi.mock("@/components/bid-countdown", () => ({ BidCountdown: mocks.BidCountdown }));

vi.mock("@/presentation/actions/item-actions", () => ({
  cancelItemAction: vi.fn(),
  deleteItemAction: vi.fn(),
  publishItemAction: vi.fn(),
}));

import { ItemsList } from "./items-list";

// ponytail: este arquivo existe por causa de uma coisa que um teste nao consegue
// provar. O rotulo da aba "Em leilao" e o MESMO texto do badge, e um teste que
// escreve "Em leilao" duas vezes passa se os dois lados divergirem ou se ficarem
// iguais — so a leitura do codigo diz qual dos dois e a fonte. O que este
// arquivo trava e o outro lado do contrato: a aba diz o que `ROTULO_STATUS` diz.
// Divergencia passa a ser vermelha; duplicacao continua invisivel para o `tsc`,
// e por isso a nota do `TABS` em `items-list.tsx` conta o resto da historia.
//
// A lista inteira e renderizada (e nao so o trecho das abas) porque `TABS` nao e
// exportado: um teste que le o que a lista mostra e o unico jeito de alcancar o
// rotulo sem abrir um buraco na API do componente so para isto.
const ABAS_DA_LISTA = ["draft", "active", "closed", "cancelled"] as const satisfies readonly ItemStatus[];

function abasDoHtml(html: string): { href: string; rotulo: string }[] {
  const ancoras = [
    ...html.matchAll(/<a [^>]*href="(\/dashboard\/items(?:\?status=[a-z]+)?)"[^>]*>([^<]*)<\/a>/g),
  ];
  return ancoras.map(([, href, rotulo]) => ({ href: href!, rotulo: rotulo! }));
}

describe("ItemsList — as abas de status", () => {
  it("cada aba de status mostra o rotulo canonico, na ordem de ciclo de vida da lista", () => {
    const abas = abasDoHtml(renderToString(<ItemsList items={[]} current="all" />));

    expect(abas.map((aba) => aba.rotulo)).toEqual([
      "Todos",
      ...ABAS_DA_LISTA.map((chave) => ROTULO_STATUS[chave]),
    ]);
  });

  it("a aba aponta para o filtro que o servidor entende, e 'Todos' para a lista sem filtro", () => {
    const abas = abasDoHtml(renderToString(<ItemsList items={[]} current="all" />));

    expect(abas.map((aba) => aba.href)).toEqual([
      "/dashboard/items",
      ...ABAS_DA_LISTA.map((chave) => `/dashboard/items?status=${chave}`),
    ]);
  });

  // ponytail: nem todo status tem aba. `paid` e `awaiting_payment` nao tem, porque a
  // lista e uma triagem do trabalho que falta, nao um inventario do historico. E a
  // assertiva e sobre o que o mapa tem e a tela nao mostra: um status novo no enum
  // NAO cria aba por conta propria, e este teste e o que impede a aba de aparecer
  // sozinha quando alguem adicionar o membro sem querer.
  it("as abas sao um recorte do vocabulario, e nao o vocabulario inteiro", () => {
    const abas = abasDoHtml(renderToString(<ItemsList items={[]} current="all" />));

    const mostrados = abas.map((aba) => aba.href.split("status=")[1] ?? "all");
    expect(mostrados).toEqual(["all", ...ABAS_DA_LISTA]);
    for (const chave of ABAS_DA_LISTA) {
      expect(Object.keys(ROTULO_STATUS)).toContain(chave);
    }
  });
});
