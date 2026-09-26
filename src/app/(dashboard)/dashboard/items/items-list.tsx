"use client";

import Link from "next/link";
import { useRef } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import type { Item, ItemType } from "@/domain/repositories/item-repository";
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

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "draft", label: "Rascunho" },
  { key: "active", label: "Em leilão" },
  { key: "closed", label: "Encerrado" },
  { key: "cancelled", label: "Cancelado" },
];

// ponytail: os rotulos de `ItemType` espelham as `<option>` do `item-form.tsx`.
// Duplicar o mapa e melhor do que a alternativa — exportar o mapa de la
// arrastaria um formulario inteiro (com react-hook-form) para o grafo de import
// desta lista. O `Record<ItemType, string>` e exaustivo: um tipo novo quebra o
// `tsc` aqui em vez de renderizar uma celula vazia.
const ROTULO_TIPO: Record<ItemType, string> = {
  product: "Produto",
  service: "Serviço",
  piece: "Peça colecionável",
};

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
// baixo. Entao as colunas de dado entregam o valor que ordena certo, e a busca
// global casa com o que esta gravado e nao com o que esta escrito. Onde o rotulo
// e da propria coluna (`tipo`) ele e o valor: ali busca e ordenacao falam a
// mesma lingua.
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
    accessorFn: (item) => item.status,
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
        <time dateTime={item.bidDeadline.toISOString()}>{item.bidDeadline.toLocaleDateString("pt-BR")}</time>
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
  items: Item[];
  current: string;
  // ponytail: `totalCount` presente e o que liga a paginacao no servidor: e ele
  // que escolhe o ramo da union do `DataTable` (`manualPagination: true` exige
  // `totalCount`). Nao e um "total opcional" que o rodape usaria por conta
  // propria — sem ele a union nem compila. Quem traz e a pagina, com o total que
  // a query devolveu; enquanto ninguem passa, a lista opera no modo cliente.
  totalCount?: number;
  pageIndex?: number;
  onPageChange?: (page: number) => void;
  onSortChange?: (sort: DataTableSort | null) => void;
  onFilterChange?: (query: string) => void;
}

export function ItemsList({
  items,
  current,
  totalCount,
  pageIndex,
  onPageChange,
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
      ? { columns: COLUNAS, data: items, pageIndex, onPageChange, onSortChange, onFilterChange }
      : {
          columns: COLUNAS,
          data: items,
          pageIndex,
          onPageChange,
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
