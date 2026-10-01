import { getSession } from "@/presentation/actions/auth-actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listSellerItems } from "@/application/use-cases/list-seller-items";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { ItensDaUrl } from "./items-list";
import { filtroDaVista, interpretarParametros, ultimaPagina, hrefDaVista } from "./estado-da-tabela";
import { paraItemDaTabela } from "./item-da-tabela";
import { BecomeSellerForm } from "@/components/become-seller-form";
import { primeiroValor } from "@/lib/primeiro-valor";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

// ponytail: esta pagina NAO tem `<Suspense>` nem `loading.tsx`, e a ausencia e uma
// decisao medida, nao uma pendencia (o `TableSkeleton` que as duas usariam tambem
// nao existe — a nota esta em `components/skeletons.tsx`). Envolver o trecho
// `<ItensDaUrl>` em uma fronteira aqui seria decorativo: o `await` da sessao e o
// `await` da listagem acontecem no corpo desta pagina, antes de o JSX existir, entao
// nada abaixo da fronteira suspende e o fallback nunca e despejado.
//
// O `loading.tsx` do segmento seria o outro caminho e ele tem um custo que a
// searches com `router.push` torna real: durante a navegacao o `loading.tsx`
// desmonta e remonta o `DataTable` inteiro a cada tecla depurada, apagando o
// `query` local e desfazendo o conserto de "busca nao descarta digitacao em voo"
// (commit `f7f300a`). Durante a navegacao o usuario ve hoje a lista antiga, que e
// mais util que um esqueleto.
//
// O caminho que sobra e o mesmo da vitrine publica (`[slug]/page.tsx`): descer a
// listagem para um filho async que suspende, para que a fronteira tenha o que
// esperar. Ele exige a reescrita do `items/page.test.tsx` (proibido aqui: esta
// entre os 159) — ver a nota em `components/skeletons.tsx` para as duas assercoes
// que quebrariam.

//
// `primeiroValor` (o parametro repetido) vem de `@/lib/primeiro-valor`, e nao e
// uma funcao local: o `?periodo` do dashboard usa a MESMA decisao ("o primeiro
// vence"), e duas copias divergiriam no primeiro parametro duplicado.

export default async function ItemsPage({ searchParams }: PageProps<"/dashboard/items">) {
  const session = await getSession();
  if (!session) return null;

  // ponytail: o "Meus itens" e o mesmo `h1` nos dois ramos, entao os dois usam o
  // `PageHeader` — um titulo de pagina nao pode depender de o usuario ter virado
  // leiloeiro, senao o `<h1>` muda de forma entre os ramos. O ramo de quem nao e
  // leiloeiro nao ganha `actions`: nao ha item novo para criar sem esse papel.
  if (session.user.role !== "seller" && session.user.role !== "both") {
    return (
      <div className="space-y-4">
        <PageHeader title="Meus itens" />
        <p className="text-muted-foreground">Você ainda não é leiloeiro.</p>
        <BecomeSellerForm />
      </div>
    );
  }

  const params = await searchParams;
  const vista = interpretarParametros((nome) => primeiroValor(params[nome]));
  const { items, total } = await listSellerItems(
    drizzleItemRepository,
    session.user.id,
    filtroDaVista(vista),
  );

  // ponytail: o `redirect` vem DEPOIS da consulta, e nao antes, porque a ultima
  // pagina so existe depois de saber o `total` — e a unica forma de saber o total
  // e contar. A alternativa seria `count()` numa segunda consulta antes de focar
  // uma linha da tabela a mais no caminho comum, para evitar uma query no caminho
  // raro (link colado de uma lista que ja encolheu, ou um `page=99` na mao).
  //
  // A guarda `page > 1` e o que separa "corrigir um link" de "redirecionar a
  // primeira pagina": `?page=1` com filtro que nao devolve nada e a PRIMEIRA
  // pagina vazia, e mandando o usuario para ela a URL nao muda de nada, o
  // historico ganha uma entrada a toa e o botao "voltar" parece quebrado. A
  // ultima pagina com piso 1 (em `ultimaPagina`) cobre o outro caso, que e o
  // unico que faria laco: filtro sem nenhum item levaria a `page=0`, que a
  // leitura rejeitaria e trocaria por 1 de novo.
  if (vista.page > 1 && items.length === 0) {
    redirect(hrefDaVista({ ...vista, page: ultimaPagina(total, vista.pageSize) }));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Meus itens"
        actions={
          <Button render={<Link href="/dashboard/items/new" />} size="sm">
            + Novo item
          </Button>
        }
      />
      <ItensDaUrl items={items.map(paraItemDaTabela)} vista={vista} totalCount={total} />
    </div>
  );
}
