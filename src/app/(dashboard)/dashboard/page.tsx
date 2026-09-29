import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getSession, signOutAction } from "@/presentation/actions/auth-actions";
import { resumoDoDashboard } from "@/application/use-cases/resumo-do-dashboard";
import { drizzleAnaliseRepository } from "@/infrastructure/database/repositories/drizzle-analise-repository";
import { VisaoDoVendedorPainel } from "./graficos/visao-vendedor";
import { VisaoDoCompradorPainel } from "./graficos/visao-comprador";
import { PeriodoSelect } from "./periodo/periodo-select";
import { interpretarPeriodo } from "./periodo/periodo";
import { primeiroValor } from "@/lib/primeiro-valor";

// ponytail: `force-dynamic` e obrigatorio aqui, e nao porFORMANCE. A pagina le a
// sessao E cinco agregados, todos dependentes de quem esta logado e de "agora"
// (a janela de 7/30/90 dias muda de conteudo a cada minuto). Sem isso o Next
// tentaria cachear um dashboard de usuario no navegador do proximo. E o mesmo
// motivo que a `(dashboard)/items/page.tsx` ja declara — o `ponytail:` de la
// descreve a leitura da URL no FIM, depois da sessao, e a mesma ordem aqui.
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const session = await getSession();
  if (!session) return null;

  // ponytail: a URL e lida DEPOIS da sessao pelo mesmo motivo do `items/page.tsx`:
  // "se nao ha sessao, nao ha consulta". Ler o `searchParams` antes gastaria um
  // `await` que so interessa a quem esta logado.
  const params = await searchParams;
  const { chave: periodo, dias } = interpretarPeriodo(primeiroValor(params.periodo));

  // ponytail: o `role` do better-auth e `string` no tipo, e nao a union do
  // dominio. A estreitura e feita AQUI, e para o ramo MENOS privilegiado: um
  // papel desconhecido (ou um `undefined` de sessao malformada) cai na visao de
  // comprador, que mostra "voce ainda nao deu nenhum lance". O contrario — dar
  // a visao de vendedor a um papel nao reconhecido — mostraria o catalogo de
  // outra pessoa ou um painel vazio com cara de bug. `resumoDoDashboard` ainda
  // checa "seller"/"both" do seu lado; esta e a mesma regra vista da pagina.
  const papel = session.user.role === "seller" || session.user.role === "both" ? "seller" : "bidder";

  const visao = await resumoDoDashboard(drizzleAnaliseRepository, session.user.id, papel, dias);

  const ehVendedor = visao.papel === "vendedor";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {ehVendedor ? "Seu painel" : "Meus lances"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Olá, {session.user.name} · {session.user.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodoSelect atual={periodo} />
          <form action={signOutAction}>
            <Button type="submit" variant="outline">Sair</Button>
          </form>
        </div>
      </div>

      <nav className="flex gap-4 text-sm">
        <Link className="text-primary underline" href="/dashboard/items">Meus itens</Link>
        <Link className="text-primary underline" href="/dashboard/settings">Editar perfil</Link>
      </nav>

      {ehVendedor ? (
        <VisaoDoVendedorPainel visao={visao} periodo={periodo} />
      ) : (
        <VisaoDoCompradorPainel visao={visao} periodo={periodo} />
      )}
    </div>
  );
}
