"use client";

import Link from "next/link";
import { useRef } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import type { Item, ItemStatus } from "@/domain/repositories/item-repository";
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
// `?status=` que a pagina ignora em silencio (a pagina so reconhece os membros que
// ela valida). E nenhuma aba nasce sozinha quando um status novo entra no enum —
// essa e uma decisao de produto, e o enum crescer nao pode virar o evento que
// aumenta a barra de filtros sozinho.
const ABAS_DE_STATUS = ["draft", "active", "closed", "cancelled"] as const satisfies readonly ItemStatus[];

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  ...ABAS_DE_STATUS.map((status) => ({ key: status, label: ROTULO_STATUS[status] })),
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
function AcoesDoItem({ item }: { item: Item }) {
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
// Onde o rotulo e da propria coluna (`tipo`, `status`) oAccessorFn entrega
// `ROTULO_TIPO`/`ROTULO_STATUS` — e aqui a busca volta a casar com o texto
// escrito, porque a COPIA sumiu: o `q` do servidor casa com o rotulo do
// dominio e o `accessorFn` do cliente le o mesmo mapa, entao os dois lados dizem a
// mesma coisa por construcao em vez de por coincidencia. Era exatamente a
// identidade que o `accessorFn` tinha de sustentar sozinho, com o enum ingles
// ("active") como valor: a busca respondia "Nenhum item encontrado." para "Em
// leilao", o termo escrito como o usuario le. Para `tipo` e `status` continua sem
// trade-off a fazer na ORDENACAO: a ordem alfabetica do enum ingles nao e um
// ciclo de vida, e a do rotulo pt-BR nao e, nenhuma das duas e "a ordem" de um
// status.
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
// componente generico, e nao numa lista. Com a busca no servidor, o `filterValue`
// so volta a valer se a camada cliente casar o valor formatado POR CIMA do `q` do
// servidor (sao os dois ramos possiveis do `DataTable` ao mesmo tempo, nao um no
// lugar do outro) — e essa e uma decisao de produto, nao uma correcao oculta.
const COLUNAS: DataTableColumn<Item>[] = [
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
    accessorFn: (item) => ROTULO_TIPO[item.type],
    cell: (item) => ROTULO_TIPO[item.type],
  },
  {
    id: "status",
    header: "Status",
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
  // ponytail: DEVIDA (Task 9) — a lista era componente de servidor, entao
  // nenhum `Item` era serializado; como cliente, cada item que a pagina passa
  // agora viaja inteiro no payload do RSC: 12 campos por linha, dos quais as
  // colunas nao usam 6, e `description` — o texto longo — vai junto sem sair na
  // tela. A correcao e um DTO montado na propria `page.tsx` (um `map` que
  // entrega so o que as colunas leem: `id`, `title`, `type`, `status`,
  // `minInitialBid`, `bidDeadline`) e nao um campo opcional em `Item`: o pin e o
  // `items: Item[]` desta interface, e mudar isso e mexer no contrato da pagina,
  // nao no desta lista. A `page.tsx` ainda busca sem limite, o que e o outro
  // lado do mesmo debito.
  items: Item[];
  current: string;
  // ponytail: `totalCount` presente e o que liga a paginacao no servidor: e ele
  // que escolhe o ramo da union do `DataTable` (`manualPagination: true` exige
  // `totalCount`). Nao e um "total opcional" que o rodape usaria por conta
  // propria — sem ele a union nem compila. Quem traz e a pagina, com o total que
  // a query devolveu; enquanto ninguem passa, a lista opera no modo cliente.
  totalCount?: number;
  // ponytail: `pageIndex` e `onPageChange` nao formam par, e o `DataTable` so
  // honra os dois no modo servidor. No modo cliente quem manda e o estado interno
  // dele: passar `onPageChange` sem `totalCount` produz callbacks que a tabela
  // nao vai cumprir (o indice do pai nao mexe no fatiamento). Quem ligar a
  // paginacao de verdade passa `totalCount` junto.
  pageIndex?: number;
  onPageChange?: (page: number) => void;
  // ponytail: `pageSize` e `onPageSizeChange` existem pela mesma razao de
  // `onPageChange` — e o Select de "linhas por pagina" e um controle do pai no
  // modo servidor. Sem o repasse, escolher 50 nao avisava ninguem: o
  // `tratarPagina` ignorava o estado interno e o `onPageSizeChange?.()` era
  // `undefined`, entao o gatilho voltava a marcar 10 em silencio.
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  onSortChange?: (sort: DataTableSort | null) => void;
  onFilterChange?: (query: string) => void;
}

export function ItemsList({
  items,
  current,
  totalCount,
  pageIndex,
  onPageChange,
  pageSize,
  onPageSizeChange,
  onSortChange,
  onFilterChange,
}: ItemsListProps) {
  // ponytail: as duas montagens do `DataTable` sao o que a union do contrato
  // exige — no modo servidor `totalCount` e obrigatorio. Escolher o objeto
  // inteiro (em vez de espalhar um `manualPagination` condicional no JSX) mantem
  // o par `manualPagination` -> `totalCount` fechando no compilador tambem no
  // consumidor.
  const tabela =
    totalCount === undefined
      ? {
          columns: COLUNAS,
          data: items,
          pageIndex,
          pageSize,
          onPageChange,
          onPageSizeChange,
          onSortChange,
          onFilterChange,
        }
      : {
          columns: COLUNAS,
          data: items,
          pageIndex,
          pageSize,
          onPageChange,
          onPageSizeChange,
          onSortChange,
          onFilterChange,
          manualPagination: true as const,
          totalCount,
        };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/dashboard/items" : `/dashboard/items?status=${tab.key}`}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              current === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <DataTable {...tabela} filterPlaceholder={PLACEHOLDER_BUSCA} emptyMessage={MENSAGEM_VAZIA} />
    </div>
  );
}
