import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { ItemStatus } from "@/domain/repositories/item-repository";
import { STATUS_LABELS } from "@/domain/repositories/item-repository";

const mocks = vi.hoisted(() => ({ BidCountdown: vi.fn() }));

vi.mock("@/components/bid-countdown", () => ({ BidCountdown: mocks.BidCountdown }));

vi.mock("@/presentation/actions/item-actions", () => ({
  cancelItemAction: vi.fn(),
  deleteItemAction: vi.fn(),
  publishItemAction: vi.fn(),
}));

import { ItemsList } from "./items-list";
import { DEFAULT_TABLE_VIEW } from "./dashboard-table-state";

// ponytail: este arquivo existe por causa de uma coisa que um teste nao consegue
// provar. O rotulo da aba "Em leilao" e o MESMO texto do badge, e um teste que
// escreve "Em leilao" duas vezes passa se os dois lados divergirem ou se ficarem
// iguais — so a leitura do codigo diz qual dos dois e a fonte. O que este
// arquivo trava e o outro lado do contrato: a aba diz o que `STATUS_LABELS` diz.
// Divergencia passa a ser vermelha; duplicacao continua invisivel para o `tsc`,
// e por isso a nota do `TABS` em `items-list.tsx` conta o resto da historia.
//
// A lista inteira e renderizada (e nao so o trecho das abas) porque `TABS` nao e
// exportado: um teste que le o que a lista mostra e o unico jeito de alcancar o
// rotulo sem abrir um buraco na API do componente so para isto.
const LIST_TABS = ["draft", "active", "closed", "cancelled"] as const satisfies readonly ItemStatus[];

// ponytail: `navigate` e uma funcao que nao faz nada neste arquivo — a assercao e
// sobre o `href` do HTML, e nao sobre navegacao. Passar e obrigatorio porque a
// lista nao aceita mais "modo cliente": quem decide a URL e o pai.
function listWith(view = DEFAULT_TABLE_VIEW): string {
  return renderToString(
    <ItemsList items={[]} view={view} totalCount={0} navigate={() => {}} />,
  );
}

// ponytail: a regex aceita qualquer query depois de `?status=`, e nao so
// `?status=xxx`. A aba e montada pelo `buildDashboardHref`, que pode preservar o
// `pageSize` escolhido pelo usuario — e um regex que so reconhecesse a forma
// "limpa" silenciosamente ignoraria a aba na hora de trocar a ordem, com o teste
// passando e a URL errada na tela. O segundo grupo (`[^"]*`) e o que garante que
// o href lido e inteiro.
function htmlTabs(html: string): { href: string; label: string }[] {
  const ancoras = [...html.matchAll(/<a [^>]*href="(\/dashboard\/items[^"]*)"[^>]*>([^<]*)<\/a>/g)];
  return ancoras.map(([, href, label]) => ({ href: href!, label: label! }));
}

describe("ItemsList — as abas de status", () => {
  it("cada aba de status mostra o rotulo canonico, na ordem de ciclo de vida da lista", () => {
    const abas = htmlTabs(listWith());

    expect(abas.map((aba) => aba.label)).toEqual([
      "Todos",
      ...LIST_TABS.map((key) => STATUS_LABELS[key]),
    ]);
  });

  it("a aba aponta para o filtro que o servidor entende, e 'Todos' para a lista sem filtro", () => {
    const abas = htmlTabs(listWith());

    expect(abas.map((aba) => aba.href)).toEqual([
      "/dashboard/items",
      ...LIST_TABS.map((key) => `/dashboard/items?status=${key}`),
    ]);
  });

  // ponytail: nem todo status tem aba. `awaiting_payment` e `paid` nao tem, porque a
  // lista e uma triagem do trabalho que falta, nao um inventario do historico. E a
  // assertiva e sobre o que o mapa tem e a tela nao mostra: um status novo no enum
  // NAO cria aba por conta propria, e este teste e o que impede a aba de aparecer
  // sozinha quando alguem adicionar o membro sem querer.
  it("as abas sao um recorte do vocabulario, e nao o vocabulario inteiro", () => {
    const abas = htmlTabs(listWith());

    const mostrados = abas.map((aba) => aba.href.split("status=")[1] ?? "all");
    expect(mostrados).toEqual(["all", ...LIST_TABS]);
    for (const key of LIST_TABS) {
      expect(Object.keys(STATUS_LABELS)).toContain(key);
    }
  });
});
