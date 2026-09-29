"use client";

import Link from "next/link";
import { useRef } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import { ROTULO_STATUS, ROTULO_TIPO } from "@/domain/repositories/item-repository";
import type { DataTableColumn } from "@/components/data-table";
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
import { FUSO } from "@/lib/fuso";
import { cancelItemAction, deleteItemAction, publishItemAction } from "@/presentation/actions/item-actions";
import type { ItemDaTabela } from "./item-da-tabela";

// ponytail: as COLUNAS moram no proprio arquivo porque e assim que o guia de
// data-table do shadcn organiza a coisa: `columns.tsx` separado do componente
// da tabela, com as ROW ACTIONS dentro dele (secao "Row Actions", que edita a
// definicao das colunas para a coluna `actions` devolver um `<DropdownMenu>`).
// O `DataTable` generico do projeto ja cumpre o papel de `data-table.tsx` do
// guia; o que faltava era o `columns.tsx` por rota.
//
// Este arquivo e CLIENT porque as celulas renderizam JSX com link, badge,
// countdown e menu. O `DataTable` tambem e client, entao a fronteira cai no
// mesmo lugar dos dois lados e nenhum dado atravessa a fronteira.

type ItemFormAction = (formData: FormData) => void | Promise<void>;
const publishItemFormAction: ItemFormAction = publishItemAction.bind(null, null) as unknown as ItemFormAction;
const deleteItemFormAction: ItemFormAction = deleteItemAction.bind(null, null) as unknown as ItemFormAction;
const cancelItemFormAction: ItemFormAction = cancelItemAction.bind(null, null) as unknown as ItemFormAction;

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
// baixo. Entao as colunas de dado entregam o valor que ordena certo.
//
// Onde o rotulo e da propria coluna (`tipo`, `status`) o accessorFn entrega
// `ROTULO_TIPO`/`ROTULO_STATUS`, e o `q` do servidor casa com o rotulo do
// dominio: os dois lados dizem a mesma coisa por construcao em vez de por
// coincidencia. Era exatamente a identidade que o `accessorFn` tinha de sustentar
// sozinho, com o enum ingles ("active") como valor: a busca respondia "Nenhum item
// encontrado." para "Em leilao", o termo escrito como o usuario le.
//
// ponytail: neste arquivo o `accessorFn` nao e lido por NENHUM caminho de leitura
// — a lista e so servidor, e o `DataTable` roda com `manualFiltering` e
// `manualSorting` ligadas, entao nem a busca nem a ordenacao do cliente passam por
// ele. Passar mesmo assim e o que mantem as colunas honestas se o modo virar: um
// `accessorFn` que so existe no ramo cliente morreria junto com ele, e a coluna
// voltaria a ser so texto (que e o que ordenaria "1.000,00" antes de "50,00").
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
// colunas de dado NAO tem: elas o carregam pelo motivo do paragrafo acima).
//
// ponytail: a busca formatada ("1.234,56", "R$", "01/10/2026") segue DEVIDA, e o
// motivo continua sendo dinheiro e prazo nao terem como ordenar e casar no mesmo
// accessor. A correcao estrutural e um `filterValue?: (row: T) => string` no
// `DataTableColumn` mapeado no `ColumnDef`. Porem ela ja nao e uma correcao
// "dupla": a lista e so servidor, a busca formatada e do servidor (o `q` do
// Postgres casa com o valor gravado, nao com o formatado), e o `filterValue` so
// voltaria a valer no ramo cliente do `DataTable`, que nenhum consumidor desta
// tela usa.
export const COLUNAS: DataTableColumn<ItemDaTabela>[] = [
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
