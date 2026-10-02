"use client";

import Link from "next/link";
import { STATUS_LABELS, type ItemStatus } from "@/domain/repositories/item-repository";
import {
  DEFAULT_SORT_DIRECTION,
  buildDashboardHref,
  DEFAULT_SORT_BY,
  DEFAULT_PAGE,
  type DashboardTableView,
} from "./dashboard-table-state";

// ponytail: as abas sao metade vocabulario e metade decisao de produto, e e a
// divisao que importa. A ORDEM (rascunho, em leilao, encerrado, cancelado) e a
// triagem do trabalho que falta, e uma escolha da tela e nao do dominio: por isso
// mora aqui e nao no `STATUS_LABELS`. O TEXTO de cada aba e o mesmo texto do badge
// e da coluna, e por isso vem do mapa. `Todos` nao e um status, e por isso e a
// unica string escrita aqui.
//
// A lista de chaves e `satisfies readonly ItemStatus[]` de proposito: uma chave que
// nao existe no enum e erro de compilacao, e nao uma aba apontando para um
// `?status=` que a pagina ignora em silencio (o leitor da URL so reconhece os
// membros do vocabulario, e o vocabulario cresce no mapa de rotulos). E nenhuma aba
// nasce sozinha quando um status novo entra no enum — essa e uma decisao de
// produto, e o enum crescer nao pode virar o evento que aumenta a barra de filtros
// sozinha.
const STATUS_TABS = ["draft", "active", "closed", "cancelled"] as const satisfies readonly ItemStatus[];

const TABS: { key: string; status: ItemStatus | null; label: string }[] = [
  { key: "all", status: null, label: "Todos" },
  ...STATUS_TABS.map((status) => ({ key: status, status, label: STATUS_LABELS[status] })),
];

export function StatusTabs({ view }: { view: DashboardTableView }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          // ponytail: a aba e um link comum, e nao um `navigate` por callback, por
          // dois motivos. O primeiro e o prefetch: um `<Link>` traz o RSC quando o
          // mouse passa, e a aba fica pronta. O segundo e o historico: `navigate` nao
          // e chamado, entao nao ha `queueMicrotask` no meio e nao se registra duas
          // entradas iguais para o mesmo destino.
          //
          // A aba ZERA busca, ordenacao e pagina, e PRESERVA o tamanho: filtro
          // "Em leilao" e tamanho 50 sao duas escolhas independentes, e quem le 50 por
          // pagina nao deveria perder isso so porque clicou numa aba. E "Todos" sem
          // nenhuma escolha devolve a string vazia — a aba e o estado inicial, entao
          // ela e o link para `/dashboard/items` sem query.
          href={buildDashboardHref({
            ...view,
            q: "",
            status: tab.status,
            orderBy: DEFAULT_SORT_BY,
            direction: DEFAULT_SORT_DIRECTION,
            page: DEFAULT_PAGE,
          })}
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            (view.status ?? "all") === tab.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
