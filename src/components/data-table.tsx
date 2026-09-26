"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  Row,
  SortingState,
  Updater,
} from "@tanstack/react-table";
import { ChevronDownIcon, ChevronsUpDownIcon, ChevronUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  accessorFn?: (row: T) => unknown;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  enableSorting?: boolean;
}

export interface DataTableSort {
  id: string;
  desc: boolean;
}

interface DataTablePropsComuns<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  pageSize?: number;
  pageIndex?: number;
  onPageChange?: (page: number) => void;
  onSortChange?: (sort: DataTableSort | null) => void;
  onFilterChange?: (query: string) => void;
  onPageSizeChange?: (pageSize: number) => void;
  // ponytail: `sort` e `filter` sao a MESMA informacao que `pageIndex`/`pageSize`,
  // so que para as outras duas casas da tabela: o que esta aplicado. A diferenca
  // e que eles sao espelhados no estado local na renderizacao (veja
  // `ordenacaoEspelhada` e `filtroEspelhado`, abaixo): a tabela guarda a intencao do
  // usuario, a prop carrega a verdade que o pai leu de algum lugar — a URL, no caso
  // da lista de itens. Sao opcionais porque no modo cliente nao ha pai: quem ordena e
  // filtra e a propria tabela, e nenhum dos dois props existe.
  sort?: DataTableSort | null;
  filter?: string;
  filterPlaceholder?: string;
  emptyMessage?: string;
}

// ponytail: `manualPagination` e `totalCount` sao um par, nao dois opcionais.
// Ligado o modo servidor, sem `totalCount` o `rowCount` fica `undefined`,
// `getRowCount()` cai no comprimento da pagina, `pageCount` vira 1, os dois
// botoes travam e o rodape anuncia "de 2" — uma tabela morta que ainda parece
// viva. A union deixa isso um erro de compilacao no consumidor em vez de um
// rodape mentindo em producao. A alternativa (so um `console.warn` em dev)
// seria tarde: o dano e silencioso e so aparece com o servidor de volta.
//
// ponytail: `sort` e `filter` entram no ramo servidor pelo mesmo motivo, e o
// defeito e ainda mais insidioso que o do `totalCount`: sem `filter` a busca
// continua funcionando (o `onFilterChange` existe) e o resultado e o filtro
// aplicado voltar para "" depois do debounce, apagando o termo que o usuario
// digitou; sem `sort`, um pai com URL mostra a seta de ordenacao no cabecalho
// errado — ou seja, a tela mente sobre o que esta ordenado. A union e a mesma
// defesa: o esquecimento vira erro de compilacao no consumidor, onde e barato,
// em vez de um diagnostico em producao, onde e caro.
export type DataTableProps<T> =
  | (DataTablePropsComuns<T> & {
      manualPagination: true;
      totalCount: number;
      sort: DataTableSort | null;
      filter: string;
    })
  | (DataTablePropsComuns<T> & { manualPagination?: false; totalCount?: number });

// ponytail: `getIsSorted()` devolve "asc"/"desc"/false e "asc" NAO e um valor
// valido de `aria-sort` — a ARIA so aceita "none" | "ascending" | "descending" |
// "other". Sem esta traducao o leitor de tela anuncia a coluna como "asc", que e
// um token que a spec nao define.
const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

const DEBOUNCE_BUSCA_MS = 300;
// ponytail: o `10` do `pageSize = 10` do DEFAULT DESTE COMPONENTE e o MESMO numero
// que `TAMANHO_DE_PAGINA_PADRAO` em `estado-da-tabela.ts` (a camada da URL), e a
// duplicacao e forcada pelo limite do App Router: com `manualPagination` quem
// calcula o `OFFSET` e o servidor, e ele nao alcanca um modulo `"use client"` — o
// `pageSize` ausente da URL precisa virar numero antes de virar query. Derivar um do
// outro nao e opcao nas duas direcoes: este componente generico nao importa de
// `src/app/(dashboard)/...` (a dependencia aponta para o outro lado), e a URL nao
// pode descobrir o padrao lendo o componente que ela manda configurar. O preco e um
// numero em dois lugares; a mitigacao e este par de notas apontando uma para a
// outra, e o `pageSize` que a URL manda e o mesmo que o `Select` desta lista oferece.
const TAMANHOS_DE_PAGINA = [5, 10, 20, 50] as const;
const ROTULO_BUSCA = "Buscar";
const ROTULO_TAMANHO = "Linhas por página";
const MARCA_COMBINANTE = /\p{Diacritic}/gu;

// ponytail: o filtro global padrao (`includesString`, alcancado por
// `globalFilterFn: "auto"`) so aplica `toLowerCase`: insensivel a caixa,
// SENSIVEL a acento. Num produto pt-BR o usuario digita "acao", "Ação" nao
// aparece e o resultado lido e "nao achou" em vez de "voce nao escreveu o
// acento". NFD decompoe o caractere em letra + marca combinante, e `Diacritic`
// cobre o `\p{M}` todo — o mesmo caminho para "ç" e para "ã".
function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(MARCA_COMBINANTE, "").toLowerCase();
}

// ponytail: os DOIS lados sao normalizados, nao so o valor da celula — normalizar
// um so faria "acao" casar e "Ação" sumir, trocando o defeito de lugar. Celula
// vazia (`accessorFn` devolvendo `null`/`undefined`) nao casa, que e o
// comportamento do `includesString` que esta funcao substitui: a busca nao
// inventa criterio novo, so deixa de penalizar o acento.
function contemSemAcento<T>(linha: Row<T>, columnId: string, valor: unknown): boolean {
  const celula = linha.getValue<unknown>(columnId);
  if (celula === null || celula === undefined) return false;
  return semAcento(String(celula)).includes(semAcento(String(valor)));
}

// ponytail: `sortable` e `enableSorting` sao o mesmo interruptor com dois nomes
// (o contrato lista os dois). Qualquer um dos dois com `false` desliga a
// ordenacao da coluna, entao um consumidor que use so um deles nao cai no caso
// "eu desliguei e a coluna continuou ordenando". Coluna sem `accessorFn` nunca
// ordena: sem valor de acesso nao ha o que comparar, e e assim que a coluna de
// acoes (botoes/links) fica fora da ordenacao sem precisar de `false`.
function ordenavel<T>(coluna: DataTableColumn<T>): boolean {
  if (coluna.sortable === false || coluna.enableSorting === false) return false;
  return coluna.accessorFn !== undefined;
}

function resolver<T>(updater: Updater<T>, base: T): T {
  return typeof updater === "function" ? (updater as (old: T) => T)(base) : updater;
}

function deOrdenacao(sort: DataTableSort | null | undefined): SortingState {
  return sort === null || sort === undefined ? [] : [{ id: sort.id, desc: sort.desc }];
}

// ponytail: os dois `undefined` contam como iguais, e nao e preciosismo: quem
// nao controla a ordenacao (`sort` ausente) e quem manda "nenhuma" (`sort: null`)
// precisam ser a mesma coisa para a tabela, e treatar um como diferente do outro
// faria a busca por parametro reescrever o estado de um componente que nunca
// pediu para ser controlado.
function mesmoSort(
  um: DataTableSort | null | undefined,
  outro: DataTableSort | null | undefined,
): boolean {
  if (um === null || um === undefined) return outro === null || outro === undefined;
  if (outro === null || outro === undefined) return false;
  return um.id === outro.id && um.desc === outro.desc;
}

export function DataTable<T>({
  columns,
  data,
  pageSize = 10,
  pageIndex = 0,
  onPageChange,
  onSortChange,
  onFilterChange,
  onPageSizeChange,
  sort,
  filter,
  filterPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado encontrado.",
  manualPagination = false,
  totalCount,
}: DataTableProps<T>): React.JSX.Element {
  // ponytail: `query` e o que esta no input (muda a cada tecla); `filtro` e o que
  // foi efetivamente aplicado a tabela (so depois do debounce).
  const [query, setQuery] = useState(filter ?? "");
  const [filtro, setFiltro] = useState(filter ?? "");
  const [sorting, setSorting] = useState<SortingState>(deOrdenacao(sort));
  // ponytail: estado interno so do modo client-side. No modo servidor (`manualPagination`)
  // a pagina vem de `pageIndex`/`pageSize` e o estado abaixo e ignorado — o
  // contrato e quem manda. `pageSize` entra aqui como valor inicial e volta a valer
  // se o pai mudar a prop depois (o efeito abaixo), para o prop nao virar letra morta.
  const [paginaInterna, setPaginaInterna] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const recentes = useRef({ onFilterChange, onPageChange, manualPagination, pageIndex });
  const filtroNotificado = useRef(filter ?? "");

  // ponytail: espelhar a prop no estado local durante a RENDERIZACAO (e nao em
  // `useEffect`) e o que mantem a tela e a URL em acordo no mesmo quadro. Em efeito
  // haveria um render com a ordenacao antiga — a seta apontando para o lado
  // errado, ou a busca vazia enquanto o texto ja esta na caixa — e so no
  // seguinte eles coincidiriam; num click duplo rapido esse quadro intermediario
  // e lido pelo usuario.
  //
  // A comparacao e POR VALOR, e nao por identidade, e por um motivo de laco: o pai
  // escreve `{ id, desc }` novo a cada render, entao comparar com `!==` resincroniza
  // sempre e o `setSorting` com array novo re-renderiza sempre. Alem disso a
  // comparacao por valor e o que preserva o clique pendente: apos o click, o
  // `sorting` local e a intencao e o pai so devolve a mesma prop enquanto o
  // servidor nao respondeu, entao nao ha o que sobrescrever. Quando a resposta
  // chega com um valor diferente, ela vence.
  const ordenacaoEspelhada = useRef(sort);
  if (!mesmoSort(sort, ordenacaoEspelhada.current)) {
    ordenacaoEspelhada.current = sort;
    setSorting(deOrdenacao(sort));
  }

  // ponytail: o mesmo espelho para a busca, e com um passo a mais: marcar o
  // `filtroNotificado` com o valor que CHEGOU. Sem isso, um termo vindo do
  // historico (voltar/avancar) ficaria 300ms na caixa como se fosse digitado e
  // dispararia um `onFilterChange` de volta — a tela escrevendo na URL o valor que
  // acabou de ler dela.
  //
  // E o que NAO entra e o valor que a propria tabela acabou de notificar
  // (`filtroNotificado.current`): esse e o ECO do pai, nao novidade dele, e
  // escreve-lo de volta na caixa apagaria a tecla que o usuario deu depois do
  // pedido. A janela e a do debounce mais a do servidor — e por isso que o defeito
  // piora em conexao lenta, que e a situacao em que o usuario ainda esta digitando
  // quando a resposta chega. Termo que a tabela NUNCA notificou (o "voltar") segue
  // repreenchendo a caixa: e o que a prop e, e o que o usuario ve na URL.
  const filtroEspelhado = useRef(filter);
  if (filter !== filtroEspelhado.current) {
    filtroEspelhado.current = filter;
    if (filter !== undefined && filter !== filtroNotificado.current) {
      filtroNotificado.current = filter;
      setQuery(filter);
      setFiltro(filter);
    }
  }

  useEffect(() => {
    recentes.current = { onFilterChange, onPageChange, manualPagination, pageIndex };
  });

  // ponytail: escrever so o `pageSize` deixava o `pageIndex` antigo vivo com o
  // tamanho novo — `pageIndex=2` com `pageSize=10` sobre 12 linhas e
  // `slice(20, 30)`: tabela vazia com rodape "21–12 de 12". A conta e a do
  // `setPageSize` do proprio TanStack (`floor(pageSize_antigo * pageIndex /
  // pageSize_novo)`), e nao um clamp no maximo, por dois motivos: ela e a MESMA
  // que o caminho do `Select` usa, entao mudar o tamanho pela UI e mudar a prop
  // dao a mesma pagina; e ela preserva a primeira linha visivel em vez de pular
  // para a ultima pagina. Nao da para so chamar `table.setPageSize` porque ele
  // passa por `onPaginationChange`, que dispararia `onPageSizeChange` de volta
  // para o pai que acabou de setar a prop.
  useEffect(() => {
    if (manualPagination) return;
    setPaginaInterna((anterior) => {
      if (anterior.pageSize === pageSize) return anterior;
      const tamanho = Math.max(1, pageSize);
      return {
        pageIndex: Math.floor((anterior.pageSize * anterior.pageIndex) / tamanho),
        pageSize: tamanho,
      };
    });
  }, [manualPagination, pageSize]);

  // ponytail: o debounce depende SO de `query`. Se `onFilterChange` viesse do
  // pai como arrow inline, ele entraria nas deps e cada re-render do pai
  // reiniciaria o timer — a busca nunca dispararia. Por isso os callbacks vivem
  // num ref atualizado a cada render.
  //
  // ponytail: `filtroNotificado` evita o timer no mount (e o disparo espurio de
  // `onFilterChange("")` logo apos abrir a tabela). Escrever no ref, e nao
  // derivar de `filtro`, porque o usuario pode digitar "a", o timer disparar, e
  // depois limpar para "" — que precisa notificar de novo.
  useEffect(() => {
    if (query === filtroNotificado.current) return;
    const timer = setTimeout(() => {
      filtroNotificado.current = query;
      setFiltro(query);
      const atual = recentes.current;
      atual.onFilterChange?.(query);
      // ponytail: no modo cliente o proprio TanStack volta para a pagina 0 quando a
      // ordenacao ou o filtro mudam (`_autoResetPageIndex`). Ele nao faz isso no
      // modo servidor — o indice e do servidor, entao a volta para 0 e
      // responsabilidade nossa, senao a busca continua presa numa pagina que o
      // servidor ja nao devolve.
      if (atual.manualPagination && atual.pageIndex !== 0) atual.onPageChange?.(0);
    }, DEBOUNCE_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const paginacao = useMemo<PaginationState>(
    () =>
      manualPagination
        ? { pageIndex: Math.max(0, pageIndex), pageSize }
        : paginaInterna,
    [manualPagination, pageIndex, pageSize, paginaInterna],
  );

  const tratarOrdenacao: OnChangeFn<SortingState> = (updater) => {
    const proxima = resolver(updater, sorting);
    setSorting(proxima);
    const primeira = proxima[0];
    onSortChange?.(primeira ? { id: primeira.id, desc: primeira.desc } : null);
    if (manualPagination && paginacao.pageIndex !== 0) onPageChange?.(0);
  };

  const tratarPagina: OnChangeFn<PaginationState> = (updater) => {
    const proxima = resolver(updater, paginacao);
    if (!manualPagination) setPaginaInterna(proxima);
    if (proxima.pageIndex !== paginacao.pageIndex) onPageChange?.(proxima.pageIndex);
    if (proxima.pageSize !== paginacao.pageSize) onPageSizeChange?.(proxima.pageSize);
  };

  const defs = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((coluna) => ({
        id: coluna.id,
        accessorFn: coluna.accessorFn,
        enableSorting: ordenavel(coluna),
        header: coluna.header,
        cell: ({ row }) => coluna.cell(row.original),
      })),
    [columns],
  );

  // ponytail: `useReactTable` esta na lista de `knownIncompatible` do
  // `react-hooks` (o mesmo formato do `form.watch()` do RHF): o aviso e de
  // memoizacao — a regra nao consegue provar que as funcoes devolvidas sao
  // estaveis — e nao de correcao. Aqui nao ha bug de stale UI: as funcoes
  // usadas no JSX sao as de `useCallback`/identidade estavel do proprio TanStack
  // e o componente nao esta sob React Compiler. Desligar so a regra, com o
  // motivo, para o proximo revisor nao reabrir a pergunta.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: defs,
    state: { sorting, globalFilter: filtro, pagination: paginacao },
    onSortingChange: tratarOrdenacao,
    onPaginationChange: tratarPagina,
    globalFilterFn: contemSemAcento,
    // ponytail: `manualPagination` sozinho NAO e manual. Sem estes dois o
    // `getFilteredRowModel` e o `getSortedRowModel` continuam rodando sobre a
    // pagina que o servidor mandou, e o resultado era uma tabela que menteva em
    // tres lugares ao mesmo tempo: sumia a pagina (o termo do usuario nao estava
    // nela), reordenava a pagina antes do servidor responder, e o rodape
    // continuava dizendo o total do servidor com a contagem na tela. Alternativa
    // considerada: nem alimentar `filtro`/`sorting` no estado. Descartada porque o
    // `aria-sort` e o icone do header leem `state.sorting` — sem ele o clique no
    // header nao daria nenhum sinal de que pegou. Aqui o estado continua alimentado
    // (a intencao do usuario e visivel) e o que nao roda e o fatiamento local.
    manualPagination,
    manualFiltering: manualPagination,
    manualSorting: manualPagination,
    rowCount: manualPagination ? totalCount : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const linhas = table.getRowModel().rows;
  const total = table.getRowCount();
  const primeiro = total === 0 ? 0 : paginacao.pageIndex * paginacao.pageSize + 1;
  const ultimo = Math.min((paginacao.pageIndex + 1) * paginacao.pageSize, total);

  // ponytail: o `pageSize` pode vir com um valor fora da lista (o consumidor
  // escolhe). O `SelectValue` do base-ui cai no valor cru e o gatilho continua
  // mostrando o numero certo, mas o tamanho em uso ficaria AUSENTE da lista — o
  // usuario veria "3" no gatilho e nao conseguiria escolher "3" de novo. A union
  // mantem a lista com o que esta em uso.
  const tamanhos = useMemo(() => {
    return [...new Set([...TAMANHOS_DE_PAGINA, paginacao.pageSize])].sort((a, b) => a - b);
  }, [paginacao.pageSize]);

  return (
    <div className="space-y-3">
      <Input
        type="search"
        aria-label={ROTULO_BUSCA}
        placeholder={filterPlaceholder}
        value={query}
        onChange={(evento) => setQuery(evento.target.value)}
        className="max-w-xs"
      />

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((grupo) => (
            <TableRow key={grupo.id}>
              {grupo.headers.map((cabecalho) => {
                const podeOrdenar = cabecalho.column.getCanSort();
                const direcao = cabecalho.column.getIsSorted();
                return (
                  <TableHead
                    key={cabecalho.id}
                    // ponytail: `aria-sort="none"` significa "ordenavel, sem
                    // ordenacao ativa"; coluna que nao ordena nao leva o atributo
                    // nenhum. So no `th` — o botao dentro dele nao repete.
                    aria-sort={podeOrdenar ? (direcao ? ARIA_SORT[direcao] : "none") : undefined}
                  >
                    {podeOrdenar ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cabecalho.column.getToggleSortingHandler()}
                        className="-ml-3"
                      >
                        {flexRender(cabecalho.column.columnDef.header, cabecalho.getContext())}
                        {direcao === "asc" ? (
                          <ChevronUpIcon aria-hidden="true" />
                        ) : direcao === "desc" ? (
                          <ChevronDownIcon aria-hidden="true" />
                        ) : (
                          <ChevronsUpDownIcon aria-hidden="true" />
                        )}
                      </Button>
                    ) : (
                      flexRender(cabecalho.column.columnDef.header, cabecalho.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {linhas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            linhas.map((linha) => (
              <TableRow key={linha.id}>
                {linha.getVisibleCells().map((celula) => (
                  <TableCell key={celula.id}>
                    {flexRender(celula.column.columnDef.cell, celula.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {`Mostrando ${primeiro}–${ultimo} de ${total} ${total === 1 ? "item" : "itens"}`}
        </p>
        <div className="flex items-center gap-2">
          <Select<number>
            value={paginacao.pageSize}
            // ponytail: o `onValueChange` do base-ui entrega `number | null` (o
            // `null` e o "selecionado foi limpo", que esta tabela nao tem como
            // oferecer — nao ha item com valor nulo na lista). Descartar e o que
            // mantem o `setPageSize` em `Updater<number>`.
            onValueChange={(valor) => {
              if (valor !== null) table.setPageSize(valor);
            }}
          >
            <SelectTrigger size="sm" aria-label={ROTULO_TAMANHO} className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tamanhos.map((tamanho) => (
                <SelectItem key={tamanho} value={tamanho}>
                  {tamanho}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
