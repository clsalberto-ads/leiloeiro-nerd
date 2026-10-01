import { getSession } from "@/presentation/actions/auth-actions";
import { resumoDoDashboard } from "@/application/use-cases/resumo-do-dashboard";
import { drizzleAnaliseRepository } from "@/infrastructure/database/repositories/drizzle-analise-repository";
import { VisaoDoVendedorPainel } from "./graficos/visao-vendedor";
import { VisaoDoCompradorPainel } from "./graficos/visao-comprador";
import { PeriodoSelect } from "./periodo/periodo-select";
import { interpretarPeriodo } from "./periodo/periodo";
import { primeiroValor } from "@/lib/primeiro-valor";
import { PageHeader } from "@/components/layout/page-header";

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

  // ponytail: o "Ola, {nome}" NAO se repete aqui — quem manda no nome e no
  // "Sair" e o `DashboardHeader`, que o `(dashboard)/layout.tsx` ja renderiza
  // acima desta pagina. A `description` carrega so o e-mail, que o header nao
  // mostra: e o dado que confirma de qual conta o painel esta aberto. O titulo
  // ("Seu painel"/"Meus lances") e o `PeriodoSelect` sao os unicos acoes do
  // cabecalho da pagina; os links para itens e perfil sao do `DashboardSidebar`.
  return (
    <div className="space-y-6">
      <PageHeader
        title={ehVendedor ? "Seu painel" : "Meus lances"}
        description={session.user.email}
        actions={<PeriodoSelect atual={periodo} />}
      />
      {ehVendedor ? (
        <VisaoDoVendedorPainel visao={visao} periodo={periodo} />
      ) : (
        <VisaoDoCompradorPainel visao={visao} periodo={periodo} />
      )}
    </div>
  );
}
