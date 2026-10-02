"use client";

import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableSort } from "@/components/data-table";
import type { EmptyStateAction } from "@/components/empty-state";
import { StatusTabs } from "./status-tabs";
import { COLUNAS } from "./columns";
import {
  sortColumnByOrder,
  DEFAULT_SORT_DIRECTION,
  buildDashboardHref,
  DEFAULT_SORT_BY,
  sortOrderByColumn,
  DEFAULT_PAGE,
  type DashboardTableView,
} from "./dashboard-table-state";
import type { DashboardItemRow } from "./dashboard-item-row";

// ponytail: este arquivo e a TABELA, e so a tabela. O que ele carrega agora e o
// que responde "como o `DataTable` controlado vira uma URL": o agrupamento das
// mudancas no microtask, a traducao entre `DataTableSort` e `orderBy`/`direction`
// da URL, e a ligacao com o `useRouter`.
//
// As tres coisas que ele carregava e nao belonged to here foram para o lugar que
// o guia de data-table do shadcn indica: as COLUNAS (com as row actions dentro)
// para `columns.tsx`, e as ABAS para `status-tabs.tsx`. O vocabulario das abas
// e as colunas sao as duas metades de "o que a tela mostra"; este arquivo e a
// metade de "o que a tela faz quando o usuario mexe".
//
// O `emptyState` ficou aqui, e nao virou modulo proprio: sao 20 linhas com um
// uso, e `items-list.empty-state.test.tsx` ja cobre as duas metades pelo
// componente renderizado. Extrair um arquivo para isso seria um arquivo a mais
// sem teste a mais.

const MENSAGEM_VAZIA = "Nenhum item encontrado.";
const EMPTY_LIST_MESSAGE = "Você ainda não tem itens.";
const SEARCH_PLACEHOLDER = "Buscar item";

// ponytail: uma tabela vazia tem DOIS motivos, e antes desta decisao os dois
// diziam a mesma frase. Com busca, aba, ordenacao e paginacao vindas da URL,
// "voce nao tem item nenhum" e "nada casou com este filtro" chegam na mesma
// celula — e so um deles tem para onde voltar. O texto unico mandava o
// vendedor que nunca vendeu nada procurar um filtro que ele nao digitou.
//
// A decisao mora AQUI, e nao no `DataTable`, porque e esta lista que sabe o que e
// um filtro (a `vista` inteira mora nela) e a tabela e generica. O que a tabela
// recebe sao as duas metades ja decididas: `emptyMessage` (o texto, contrato
// antigo, uma string) e `emptyAction` (para onde ir). Nenhuma das duas muda de
// tipo, entao nenhum consumidor existente precisou ser reescrito.
//
// O "voltar" e um LINK cujo `href` nasce do `buildStorefrontHref`, e nao um botao que
// chama `navegar`. Um botao perderia as afinidades que so um link tem — abrir em
// nova aba, clique do meio, ctrl-clique, copiar endereco, a URL na barra de status,
// o rastreamento — sem ganhar nada em troca: a propriedade que importa aqui e
// "a URL e escrita num lugar so", e ela continua valendo, porque quem escreve a
// URL continua sendo o `buildStorefrontHref` (aqui chamado com a vista sem filtro, que e
// a MESMA frase de URL com outra vista — nao uma segunda copia do endereco). A
// costura `navegar(vista)` continua existindo para o resto da tela, onde o
// destino depende de um clique e nao de um link: pagina, ordenacao, busca e
// tamanho.
//
// O que o "voltar" DESFAZ e so o filtro — `q`, `status` e a pagina, que sem
// filtro nao significa nada. A ordenacao e o tamanho da pagina NAO sao
// desfeitos: o usuario escolheu a coluna e quantas linhas quer ver, e "limpar
// filtros" nao pode desfazer um clique numa coluna. (As abas zeram tambem a
// ordenacao, e la e outra decisao: trocar de aba e trocar de visao, nao corrigir
// uma busca.)
function emptyState(view: DashboardTableView): {
  emptyMessage: string;
  emptyAction?: EmptyStateAction;
} {
  const filtered = view.q !== "" || view.status !== null;
  if (!filtered) {
    // ponytail: sem filtro nao ha nada para desfazer, e por isso o estado vazio
    // NAO tem acao. O "+ Novo item" do titulo da pagina e o caminho para criar, a
    // duas linhas de distancia — e um CTA aqui seria o mesmo link duas vezes na
    // tela. O que muda aqui e a FRASE: "voce nao tem nada" e "nada casou com o
    // que voce procurou" pedem palavras diferentes mesmo sem acao nenhuma.
    return { emptyMessage: EMPTY_LIST_MESSAGE };
  }
  return {
    emptyMessage: MENSAGEM_VAZIA,
    emptyAction: { label: "Limpar filtros", href: buildDashboardHref(listWithoutFilters(view)) },
  };
}

function listWithoutFilters(view: DashboardTableView): DashboardTableView {
  return { ...view, q: "", status: null, page: DEFAULT_PAGE };
}

export interface ItemsListProps {
  // ponytail: o DTO, e nao `Item`. Esta interface era o pin do debito que a parte 1
  // desta tarefa registrou: como cliente, cada `Item` inteiro viaja no payload do
  // RSC — 12 campos por linha, 6 deles fora da tela, e `description` (o texto longo)
  // junto. O DTO (`dashboard-item-row.ts`) entrega os seis campos que as colunas leem, e
  // o teste dele exige exatamente esses seis, entao um campo novo do dominio nao
  // entra no payload sem o teste reclamar.
  items: DashboardItemRow[];
  // ponytail: a tela e CONTROLADA, e a fonte da verdade e a URL. Antes eram cinco
  // props independentes (`current`, `pageIndex`, `pageSize`, mais os quatro
  // callbacks) que o pai podia combinar em estados que a URL nao representa:
  // `pageIndex: 2` com o `pageSize` de outro filtro, `current: "all"` com
  // `?status=draft` na URL. Uma `DashboardTableView` e a mesma frase em um objeto so — e
  // o que faz o link colado e o botao voltar concordarem com a tela.
  view: DashboardTableView;
  // ponytail: `totalCount` e obrigatorio, e nao opcional, porque a lista e
  // SERVIDOR. Isso nao e um detalhe de implementacao: e o que impede o modo cliente
  // do `DataTable` de existir aqui. O ramo cliente existe (o componente e generico e
  // ele tem teste), mas nesta tela ele seria uma fiction — sem o total do servidor o
  // rodape mentiria ("Mostrando 1–10 de 10" com 300 itens no banco) e o "proxima"
  // travaria. O preco da obrigatoriedade e um `totalCount` a mais em cada teste
  // desta lista, e ele e justo: quem monta a tela tem o total.
  totalCount: number;
  // ponytail: `navegar` e uma funcao e nao o `router` porque a lista nao deve
  // saber QUE roteador existe. E o que mantem os testes de DOM sem `vi.mock` de
  // `next/navigation`: eles passam um `vi.fn()` e conferem a VISTA que saiu, e nao a
  // string que o Next receberia. Um `useRouter()` dentro daqui jogaria fora essa
  // metade dos testes (o `useRouter` do Next 16 lanca fora do App Router) e
  // obrigaria cada arquivo a saber de mock.
  navigate: (view: DashboardTableView) => void;
}

export function ItemsList({ items, view, totalCount, navigate }: ItemsListProps) {
  // ponytail: o espelho do pai guarda SO o que ainda nao virou URL, e nao uma copia
  // da vista. A diferenca nao e estetica: a base de cada mudanca e a PROP `vista`,
  // lida no proprio gesto, entao nao existe nada para reconciliar durante o render
  // — e na reconciliacao que a regra `react-hooks/refs` acusa, porque um ref
  // lido ou escrito no corpo do componente sobrevive a um render descartado
  // (React 19 concorrente) e passa a valer um estado que nunca foi commitado.
  //
  // O `if (destino.current !== vista)` que existia aqui era consequencia de guardar
  // a copia: sem ele, um clique depois que o pai devolveu a vista nova sairia da
  // tela antiga. Com a prop como base ele nao tem mais o que sincronizar — e a
  // garantia de laco tambem fica mais barata, porque `aplicar` so e alcancavel por
  // gesto do usuario (os quatro callbacks do `DataTable`): nenhuma prop chega ate
  // ele, entao a tela nunca escreve na URL sozinha, que e o laco que
  // "prop mudou, entao navega" produziria.
  //
  // O ref ainda e necessario (e nao um `useState`) pelo `handlePage` do
  // `DataTable`: ele dispara `onPageChange` e `onPageSizeChange` no mesmo tick
  // quando o "proxima" tambem estoura o tamanho da pagina (o reposicionamento que a
  // propria tabela faz ao trocar o tamanho). Duas mudancas, dois `router.push`, e o
  // segundo venceria a URL. O microtask junta o par em um so e faz a troca de
  // tamanho custar uma navegacao em vez de duas — e o estado lido no mesmo tick
  // precisa ser o mais novo, o que `useState` nao garante aqui.
  const pendentes = useRef<Partial<DashboardTableView>>({});
  const agendado = useRef(false);

  const aplicar = (mudanca: Partial<DashboardTableView>) => {
    pendentes.current = { ...pendentes.current, ...mudanca };
    if (agendado.current) return;
    agendado.current = true;
    // ponytail: a base e capturada no GESTO, e nao lida no microtask. A vista que o
    // usuario corrigiu e a que ele estava vendo; o microtask nao tem como ler outra,
    // porque `vista` e um `const` do render que CRIOU este `aplicar` — a closure o
    // carrega por valor, e nao por prop. Ler `vista` la dentro daria o mesmo
    // resultado, entao a escolha e de legibleza (o `const base` nomeia o que a
    // mudanca vai ser aplicada sobre) e nao decorrecao.
    const base = view;
    queueMicrotask(() => {
      agendado.current = false;
      const target = { ...base, ...pendentes.current };
      pendentes.current = {};
      navigate(target);
    });
  };

  // ponytail: `sort` e a `DataTableSort` que a tabela le, montada DA VISTA e nao
  // guardada em estado proprio — e por isso que ela e `null` (nenhuma coluna
  // ordenada) em vez de "createdAt", ja que `createdAt` nao tem coluna na tela.
  const ordenacao = useMemo<DataTableSort | null>(() => {
    const column = sortColumnByOrder(view.orderBy);
    return column === null ? null : { id: column, desc: view.direction === "desc" };
  }, [view.direction, view.orderBy]);

  const handleSort = (sort: DataTableSort | null) => {
    // ponytail: sort "nulo" e "volte ao padrao", nao "some com a ordenacao". A URL
    // nao tem como representar "sem ordenacao" — a tela sempre esta ordenada por
    // alguma coisa, e sem parametro a leitura assume `createdAt desc` — entao o
    // terceiro clique do ciclo do TanStack (que volta para `[]`) devolve a tela ao
    // padrao em vez de deixar a seta sumir. Um `?semOrdenacao=1` seria um
    // parametro que existe so para descrever a ausencia de um padrao.
    if (sort === null) {
      aplicar({
        orderBy: DEFAULT_SORT_BY,
        direction: DEFAULT_SORT_DIRECTION,
        page: DEFAULT_PAGE,
      });
      return;
    }
    const orderBy = sortOrderByColumn(sort.id);
    // ponytail: coluna que nao sabe voltar para `orderBy` e ignorada, e nao
    // adivinhada. A unica fonte de id invalido seria um consumidor futuro desses
    // botoes, e nesse caso a URL mentindo (`?orderBy=xxx`, que o leitor troca por
    // `createdAt desc`) seria pior do que um clique sem efeito.
    if (orderBy === undefined) return;
    aplicar({ orderBy, direction: sort.desc ? "desc" : "asc", page: DEFAULT_PAGE });
  };

  // ponytail: toda mudanca de busca, de ordenacao e de status volta para a pagina
  // 1. Sem isso, filtrar na pagina 5 mostraria a pagina 5 do resultado novo — que
  // quase sempre esta vazia — e o usuario leria "nada encontrado" num filtro que
  // tem itens. A primeira pagina e a unica que existe com certeza.
  const handleSearch = (q: string) => aplicar({ q, page: DEFAULT_PAGE });
  const handlePage = (indice: number) => aplicar({ page: indice + 1 });

  const empty = emptyState(view);

  return (
    <div className="space-y-4">
      <StatusTabs view={view} />

      <DataTable
        columns={COLUNAS}
        data={items}
        pageIndex={view.page - 1}
        pageSize={view.pageSize}
        sort={ordenacao}
        filter={view.q}
        onPageChange={handlePage}
        onPageSizeChange={(pageSize) => aplicar({ pageSize })}
        onSortChange={handleSort}
        onFilterChange={handleSearch}
        manualPagination
        totalCount={totalCount}
        filterPlaceholder={SEARCH_PLACEHOLDER}
        emptyMessage={empty.emptyMessage}
        emptyAction={empty.emptyAction}
      />
    </div>
  );
}

// ponytail: a ligacao com o roteador e uma funcao a parte, e nao um `useRouter()`
// dentro de `ItemsList`. As duas razoes: (1) o `useRouter` do Next 16 lanca
// `invariant expected app router to be mounted` fora do App Router, o que
// obrigaria TODOS os testes desta lista (que rodam num `act` de React puro, sem
// Next) a carregar um mock de `next/navigation`; (2) mesmo com o mock, o teste
// teria de conferir `router.push("/dashboard/items?page=2")` em vez de conferir a
// VISTA que a lista decidiu — e a vista e o contrato, a string e a consequencia
// dela. Este e o unico lugar do arquivo que sabe de `next`.
export function ItemsUrl({
  items,
  view,
  totalCount,
}: Omit<ItemsListProps, "navigate">): React.JSX.Element {
  const router = useRouter();
  return (
    <ItemsList
      items={items}
      view={view}
      totalCount={totalCount}
      navigate={(next) => router.push(buildDashboardHref(next))}
    />
  );
}
