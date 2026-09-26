import { getSession } from "@/presentation/actions/auth-actions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listSellerItems } from "@/application/use-cases/list-seller-items";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { ItensDaUrl } from "./items-list";
import { filtroDaVista, interpretarParametros, ultimaPagina, hrefDaVista } from "./estado-da-tabela";
import { paraItemDaTabela } from "./item-da-tabela";
import { BecomeSellerForm } from "@/components/become-seller-form";

export const dynamic = "force-dynamic";

// ponytail: a URL e lida no FIM, depois da sessao, e nao logo no primeiro await. A
// ordem e "se nao ha pagina, nao ha consulta": o `dynamic = "force-dynamic"` acima
// garante que a leitura e por requisicao, entao nao ha cache de pagina que
// justificasse ler antes, e o `BecomeSellerForm` e a tela de quem nao tem lista
// nenhuma — uma consulta para o userId de um nao-vendedor devolve `total = 0` que
// so seria jogado fora. O `await searchParams` e obrigatorio (o Next 16 entrega uma
// PROMESSA) e e o que o compilador cobra daqui.
//
// ponytail: `primeiroValor` resolve a unica diferenca entre o `searchParams` do
// Next (`string | string[] | undefined`) e o `URLSearchParams` do cliente, que e
// parametro repetido. Repetir `?page=2&page=9` e um link malformado, e a escolha
// ("o primeiro vence") e a que o `URLSearchParams.get` faz, entao servidor e
// cliente concordam em vez de divergir so no parametro duplicado.
function primeiroValor(valor: string | string[] | undefined): string | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

export default async function ItemsPage({ searchParams }: PageProps<"/dashboard/items">) {
  const session = await getSession();
  if (!session) return null;

  if (session.user.role !== "seller" && session.user.role !== "both") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Meus itens</h1>
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meus itens</h1>
        <Link href="/dashboard/items/new" className="text-sm font-medium text-primary underline">+ Novo item</Link>
      </div>
      <ItensDaUrl items={items.map(paraItemDaTabela)} vista={vista} totalCount={total} />
    </div>
  );
}
