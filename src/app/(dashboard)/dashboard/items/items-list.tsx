"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontalIcon } from "lucide-react";
import type { ItemStatus } from "@/domain/repositories/item-repository";
import { ROTULO_STATUS, ROTULO_TIPO } from "@/domain/repositories/item-repository";
import { DataTable, type DataTableColumn, type DataTableSort } from "@/components/data-table";
import { ItemStatusBadge } from "@/components/item-status-badge";
import { BidCountdown } from "@/components/bid-countdown";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatReais } from "@/lib/format-reais";
import { cancelItemAction, deleteItemAction, publishItemAction } from "@/presentation/actions/item-actions";
import {
  colunaDaOrdenacao,
  DIRECAO_DA_VISTA_PADRAO,
  hrefDaVista,
  ORDENACAO_PADRAO,
  ordenacaoDaColuna,
  PAGINA_PADRAO,
  type VistaDaTabela,
} from "./estado-da-tabela";
import type { ItemDaTabela } from "./item-da-tabela";

type ItemFormAction = (formData: FormData) => void | Promise<void>;
const publishItemFormAction: ItemFormAction = publishItemAction.bind(null, null) as unknown as ItemFormAction;
const deleteItemFormAction: ItemFormAction = deleteItemAction.bind(null, null) as unknown as ItemFormAction;
const cancelItemFormAction: ItemFormAction = cancelItemAction.bind(null, null) as unknown as ItemFormAction;

// ponytail: as abas sao metade vocabulario e metade decisao de produto, e e a
// divisao que importa. A ORDEM (rascunho, em leilao, encerrado, cancelado) e a
// triagem do trabalho que falta, e uma escolha da tela e nao do dominio: por isso
// mora aqui e nao no `ROTULO_STATUS`. O TEXTO de cada aba e o mesmo texto do badge
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
const ABAS_DE_STATUS = ["draft", "active", "closed", "cancelled"] as const satisfies readonly ItemStatus[];

const TABS: { key: string; status: ItemStatus | null; label: string }[] = [
  { key: "all", status: null, label: "Todos" },
  ...ABAS_DE_STATUS.map((status) => ({ key: status, status, label: ROTULO_STATUS[status] })),
];

// ponytail: o fuso do PRODUTO, nao o do processo. A celula e SSR'd e
// re-renderizada no cliente, entao um servidor em UTC (o padrao de nuvem) e um
// navegador em Sao Paulo veriam o mesmo instante com textos diferentes — o React
// acusa divergencia de hidratacao no texto do `<time>` e descarta a arvore do
// servidor. E o efeito no produto e pior que o aviso: o `item-form` le o
// `datetime-local` como hora local, entao o vendedor digitando "30/09 22:00"
// submete `2026-10-01T01:00Z` e a lista mostraria "01/10" num servidor em UTC —
// um dia depois do prazo que ele acabou de cadastrar. `bid-history.tsx` repete o
// padrao, mas la o componente e de servidor e nao hidrata: mesmo defeito, sem o
// risco. A alternativa seria o servidor rodar em Sao Paulo (fuso do processo =
// fuso do produto); fixar aqui deixa o fuso do produto explicito e igual em
// qualquer maquina, sem depender de onde o deploy caiu.
const FUSO = "America/Sao_Paulo";

const MENSAGEM_VAZIA = "Nenhum item encontrado.";
const PLACEHOLDER_BUSCA = "Buscar item";

// ponytail: o `<form>` fica FORA do menu e o item do menu e que dispara o
// `requestSubmit`. Com o form DENTRO do item, o clique fecharia o menu (o base-ui
// fecha no click) e desmancharia o proprio form antes de o navegador executar o
// submit do botao — a acao viraria um item de menu que nao faz nada. Aqui o form
// fica montado na celula e o `onClick` do item o submete.
//
// ponytail: as tres acoes estao escritas uma a uma, e nao num array de dados com
// a ref dentro. A regra `react-hooks/refs` (a analise de refs do compilador) so
// aceita uma arrow que le `ref.current` quando ela nasce direto num prop de
// evento do JSX: dentro de um array no corpo do componente ela vira "funcao que
// pode ser chamada durante o render" e o lint acusa. O preco e a repeticao de
// tres linhas; o ganho e o menu inteiro legivel sem indirection.
function AcoesDoItem({ item }: { item: ItemDaTabela }) {
  const refPublicar = useRef<HTMLFormElement>(null);
  const refExcluir = useRef<HTMLFormElement>(null);
  const refCancelar = useRef<HTMLFormElement>(null);

  // ponytail: quem pode o quê e a mesma regra da lista antiga em `<li>`: rascunho
  // publica e exclui; em leilao e encerrado, cancela. Item pago, aguardando
  // pagamento ou cancelado nao tem acao nenhuma — e sem acao o gatilho some,
  // porque um menu vazio e um beco sem saida.
  const podePublicar = item.status === "draft";
  const podeExcluir = item.status === "draft";
  const podeCancelar = item.status === "active" || item.status === "closed";
  if (!podePublicar && !podeExcluir && !podeCancelar) return null;

  return (
    <>
      {podePublicar ? (
        <form ref={refPublicar} action={publishItemFormAction} hidden>
          <input type="hidden" name="id" value={item.id} />
        </form>
      ) : null}
      {podeExcluir ? (
        <form ref={refExcluir} action={deleteItemFormAction} hidden>
          <input type="hidden" name="id" value={item.id} />
        </form>
      ) : null}
      {podeCancelar ? (
        <form ref={refCancelar} action={cancelItemFormAction} hidden>
          <input type="hidden" name="id" value={item.id} />
        </form>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Ações de ${item.title}`} />}
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {podePublicar ? (
            <DropdownMenuItem onClick={() => refPublicar.current?.requestSubmit()}>
              Publicar
            </DropdownMenuItem>
          ) : null}
          {podeExcluir ? (
            <DropdownMenuItem variant="destructive" onClick={() => refExcluir.current?.requestSubmit()}>
              Excluir
            </DropdownMenuItem>
          ) : null}
          {podeCancelar ? (
            <DropdownMenuItem variant="destructive" onClick={() => refCancelar.current?.requestSubmit()}>
              Cancelar
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

// ponytail: o `accessorFn` e, ao mesmo tempo, o valor que a coluna ORDENA e o
// valor que a busca global CASA — e ele nao pode ser as duas coisas. Dinheiro
// (`minInitialBid`) e prazo (`getTime()`) ordenam certo como numero e nao casam
// com o texto que o usuario le; o inverso ("R$ 1.234,56", "01/10/2026")
// ordenaria "1.000,00" antes de "50,00" e viraria o calendario de cabeca para
// baixo. Entao as colunas de dado entregam o valor que ordena certo, e a busca casa
// com o que esta gravado e nao com o que esta escrito.
//
// Onde o rotulo e da propria coluna (`tipo`, `status`) o accessorFn entrega
// `ROTULO_TIPO`/`ROTULO_STATUS` — e aqui a busca volta a casar com o texto
// escrito, porque a COPIA sumiu: o `q` do servidor casa com o rotulo do
// dominio e o `accessorFn` do cliente le o mesmo mapa, entao os dois lados dizem a
// mesma coisa por construcao em vez de por coincidencia. Era exatamente a
// identidade que o `accessorFn` tinha de sustentar sozinho, com o enum ingles
// ("active") como valor: a busca respondia "Nenhum item encontrado." para "Em
// leilao", o termo escrito como o usuario le.
//
// ponytail: `tipo` e `status` sao `sortable: false` por um motivo que ja estava
// escrito acima e so agora fecha: a ordem alfabetica do enum ingles nao e um
// ciclo de vida, e a do rotulo pt-BR nao e, nenhuma das duas e "a ordem" de um
// status. E, diferente do resto das colunas, elas nao TEM como ordenar: a union
// `ItemOrderBy` do repositorio e `createdAt | title | minInitialBid | bidDeadline`
// — nao ha `status` nem `type` que o servidor aceite. Uma coluna ordenavel sem
// `orderBy` correspondente produziria um clique que escreve
// `?orderBy=status&direction=asc`, que o leitor rejeita e converte de volta para
// `createdAt desc`: a seta animaria, a URL mudaria e a tabela voltaria na ordem
// antiga. E um `sortable: true` aqui seria mentira nos dois sentidos, entao o
// desligamento e explicito e nao herdado da ausencia de `accessorFn` (que as
// colunas de dado nao podem usar, porque elas PRECISAM do `accessorFn` para a
// busca).
//
// ponytail: DEVIDA (Task 9) — a busca ainda nao acha "1.234,56", "R$" nem
// "01/10/2026", porque dinheiro e prazo nao tem como ordenar e casar no mesmo
// accessor. A correcao estrutural e um segundo valor de busca na coluna, sem
// mexer no `getSortedRowModel`: (1) `filterValue?: (row: T) => string` no
// `DataTableColumn`; (2) mapeado no `ColumnDef` em `data-table.tsx`;
// (3) no `contemSemAcento`, ler
// `def.filterValue ? def.filterValue(row.original) : row.getValue(columnId)`.
// Sao ~8 linhas, e `filterValue` continuaria opcional — as colunas de hoje seguem
// com o `accessorFn` como valor de busca. Atraso deliberado: e uma mudanca no
// componente generico, e nao numa lista. E agora que a lista e so servidor, a
// correcao nao e mais "dupla": a busca formatada e do servidor (o `q` do Postgres
// casa com o valor gravado, nao com o formatado), e o `filterValue` so volta a
// valer no ramo cliente do `DataTable`, que nenhum consumidor desta tela usa.
const COLUNAS: DataTableColumn<ItemDaTabela>[] = [
  {
    id: "titulo",
    header: "Título",
    accessorFn: (item) => item.title,
    cell: (item) => (
      <Link href={`/dashboard/items/${item.id}/edit`} className="font-medium text-primary hover:underline">
        {item.title}
      </Link>
    ),
  },
  {
    id: "tipo",
    header: "Tipo",
    sortable: false,
    accessorFn: (item) => ROTULO_TIPO[item.type],
    cell: (item) => ROTULO_TIPO[item.type],
  },
  {
    id: "status",
    header: "Status",
    sortable: false,
    accessorFn: (item) => ROTULO_STATUS[item.status],
    cell: (item) => <ItemStatusBadge status={item.status} />,
  },
  {
    id: "lanceMinimo",
    header: "Lance mínimo",
    accessorFn: (item) => item.minInitialBid,
    cell: (item) => `R$ ${formatReais(item.minInitialBid)}`,
  },
  {
    id: "prazo",
    header: "Deadline",
    accessorFn: (item) => item.bidDeadline.getTime(),
    cell: (item) => (
      <div className="flex flex-col">
        <time dateTime={item.bidDeadline.toISOString()}>
          {item.bidDeadline.toLocaleDateString("pt-BR", { timeZone: FUSO })}
        </time>
        {item.status === "active" ? <BidCountdown deadline={item.bidDeadline} /> : null}
      </div>
    ),
  },
  {
    // ponytail: a coluna de acoes NAO tem `accessorFn` — e assim que a coluna
    // fica fora da ordenacao sem precisar de `sortable: false`: sem valor de
    // acesso nao ha o que comparar, e botao e link nao tem ordem.
    id: "acoes",
    header: "Ações",
    cell: (item) => <AcoesDoItem item={item} />,
  },
];

export interface ItemsListProps {
  // ponytail: o DTO, e nao `Item`. Esta interface era o pin do debito que a parte 1
  // desta tarefa registrou: como cliente, cada `Item` inteiro viaja no payload do
  // RSC — 12 campos por linha, 6 deles fora da tela, e `description` (o texto longo)
  // junto. O DTO (`item-da-tabela.ts`) entrega os seis campos que as colunas leem, e
  // o teste dele exige exatamente esses seis, entao um campo novo do dominio nao
  // entra no payload sem o teste reclamar.
  items: ItemDaTabela[];
  // ponytail: a tela e CONTROLADA, e a fonte da verdade e a URL. Antes eram cinco
  // props independentes (`current`, `pageIndex`, `pageSize`, mais os quatro
  // callbacks) que o pai podia combinar em estados que a URL nao representa:
  // `pageIndex: 2` com o `pageSize` de outro filtro, `current: "all"` com
  // `?status=draft` na URL. Uma `VistaDaTabela` e a mesma frase em um objeto so — e
  // o que faz o link colado e o botao voltar concordarem com a tela.
  vista: VistaDaTabela;
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
  navegar: (vista: VistaDaTabela) => void;
}

export function ItemsList({ items, vista, totalCount, navegar }: ItemsListProps) {
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
  // O ref ainda e necessario (e nao um `useState`) pelo `tratarPagina` do
  // `DataTable`: ele dispara `onPageChange` e `onPageSizeChange` no mesmo tick
  // quando o "proxima" tambem estoura o tamanho da pagina (o reposicionamento que a
  // propria tabela faz ao trocar o tamanho). Duas mudancas, dois `router.push`, e o
  // segundo venceria a URL. O microtask junta o par em um so e faz a troca de
  // tamanho custar uma navegacao em vez de duas — e o estado lido no mesmo tick
  // precisa ser o mais novo, o que `useState` nao garante aqui.
  const pendentes = useRef<Partial<VistaDaTabela>>({});
  const agendado = useRef(false);

  const aplicar = (mudanca: Partial<VistaDaTabela>) => {
    pendentes.current = { ...pendentes.current, ...mudanca };
    if (agendado.current) return;
    agendado.current = true;
    // ponytail: a base e capturada no GESTO, e nao lida no microtask. A vista que o
    // usuario corrigiu e a que ele estava vendo; se a prop mudasse no caminho (nao
    // acontece — o microtask roda antes do proximo render), a mudanca cairia sobre
    // uma tela que ninguem pediu para corrigir.
    const base = vista;
    queueMicrotask(() => {
      agendado.current = false;
      const destino = { ...base, ...pendentes.current };
      pendentes.current = {};
      navegar(destino);
    });
  };

  // ponytail: `sort` e a `DataTableSort` que a tabela le, montada DA VISTA e nao
  // guardada em estado proprio — e por isso que ela e `null` (nenhuma coluna
  // ordenada) em vez de "createdAt", ja que `createdAt` nao tem coluna na tela.
  const ordenacao = useMemo<DataTableSort | null>(() => {
    const coluna = colunaDaOrdenacao(vista.orderBy);
    return coluna === null ? null : { id: coluna, desc: vista.direction === "desc" };
  }, [vista.direction, vista.orderBy]);

  const tratarOrdenacao = (sort: DataTableSort | null) => {
    // ponytail: sort "nulo" e "volte ao padrao", nao "some com a ordenacao". A URL
    // nao tem como representar "sem ordenacao" — a tela sempre esta ordenada por
    // alguma coisa, e sem parametro a leitura assume `createdAt desc` — entao o
    // terceiro clique do ciclo do TanStack (que volta para `[]`) devolve a tela ao
    // padrao em vez de deixar a seta sumir. Um `?semOrdenacao=1` seria um
    // parametro que existe so para descrever a ausencia de um padrao.
    if (sort === null) {
      aplicar({
        orderBy: ORDENACAO_PADRAO,
        direction: DIRECAO_DA_VISTA_PADRAO,
        page: PAGINA_PADRAO,
      });
      return;
    }
    const orderBy = ordenacaoDaColuna(sort.id);
    // ponytail: coluna que nao sabe voltar para `orderBy` e ignorada, e nao
    // adivinhada. A unica fonte de id invalido seria um consumidor futuro desses
    // botoes, e nesse caso a URL mentindo (`?orderBy=xxx`, que o leitor troca por
    // `createdAt desc`) seria pior do que um clique sem efeito.
    if (orderBy === undefined) return;
    aplicar({ orderBy, direction: sort.desc ? "desc" : "asc", page: PAGINA_PADRAO });
  };

  // ponytail: toda mudanca de busca, de ordenacao e de status volta para a pagina
  // 1. Sem isso, filtrar na pagina 5 mostraria a pagina 5 do resultado novo — que
  // quase sempre esta vazia — e o usuario leria "nada encontrado" num filtro que
  // tem itens. A primeira pagina e a unica que existe com certeza.
  const tratarBusca = (q: string) => aplicar({ q, page: PAGINA_PADRAO });
  const tratarPagina = (indice: number) => aplicar({ page: indice + 1 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            // ponytail: a aba e um link comum, e nao um `navegar` por callback, por
            // dois motivos. O primeiro e o prefetch: um `<Link>` traz o RSC quando o
            // mouse passa, e a aba fica pronta. O segundo e o historico: `navegar` nao
            // e chamado, entao nao ha `queueMicrotask` no meio e nao se registra duas
            // entradas iguais para o mesmo destino.
            //
            // A aba ZERA busca, ordenacao e pagina, e PRESERVA o tamanho: filtro
            // "Em leilao" e tamanho 50 sao duas escolhas independentes, e quem le 50 por
            // pagina nao deveria perder isso so porque clicou numa aba. E "Todos" sem
            // nenhuma escolha devolve a string vazia — a aba e o estado inicial, entao
            // ela e o link para `/dashboard/items` sem query.
            href={hrefDaVista({
              ...vista,
              q: "",
              status: tab.status,
              orderBy: ORDENACAO_PADRAO,
              direction: DIRECAO_DA_VISTA_PADRAO,
              page: PAGINA_PADRAO,
            })}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              (vista.status ?? "all") === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <DataTable
        columns={COLUNAS}
        data={items}
        pageIndex={vista.page - 1}
        pageSize={vista.pageSize}
        sort={ordenacao}
        filter={vista.q}
        onPageChange={tratarPagina}
        onPageSizeChange={(pageSize) => aplicar({ pageSize })}
        onSortChange={tratarOrdenacao}
        onFilterChange={tratarBusca}
        manualPagination
        totalCount={totalCount}
        filterPlaceholder={PLACEHOLDER_BUSCA}
        emptyMessage={MENSAGEM_VAZIA}
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
export function ItensDaUrl({
  items,
  vista,
  totalCount,
}: Omit<ItemsListProps, "navegar">): React.JSX.Element {
  const router = useRouter();
  return (
    <ItemsList
      items={items}
      vista={vista}
      totalCount={totalCount}
      navegar={(proxima) => router.push(hrefDaVista(proxima))}
    />
  );
}
