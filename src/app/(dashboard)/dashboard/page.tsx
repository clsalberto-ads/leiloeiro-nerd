import { getSession } from "@/presentation/actions/auth-actions";
import { getDashboardSummary } from "@/application/use-cases/dashboard-summary";
import { getDashboardMonetaryKPIs } from "@/application/use-cases/analytics/get-dashboard-monetary-kpis";
import { drizzleAnalyticsRepository } from "@/infrastructure/database/repositories/drizzle-analytics-repository";
import { SellerPanel } from "./charts/seller-view";
import { BuyerPanel } from "./charts/buyer-view";
import { PeriodSelect } from "./period/period-select";
import { parsePeriod, type PeriodKey } from "./period/period";
import { firstValue } from "@/lib/first-value";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";

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
  const { key: period, days } = parsePeriod(firstValue(params.periodo));

  // ponytail: o `role` do better-auth e `string` no tipo, e nao a union do
  // dominio. A estreitura e feita AQUI, e para o ramo MENOS privilegiado: um
  // papel desconhecido (ou um `undefined` de sessao malformada) cai na visao de
  // comprador, que mostra "voce ainda nao deu nenhum lance". O contrario — dar
  // a visao de vendedor a um papel nao reconhecido — mostraria o catalogo de
  // outra pessoa ou um painel vazio com cara de bug. `getDashboardSummary` ainda
  // checa "seller"/"both" do seu lado; esta e a mesma regra vista da pagina.
  const role = session.user.role === "seller" || session.user.role === "both" ? "seller" : "bidder";

  const view = await getDashboardSummary(drizzleAnalyticsRepository, session.user.id, role, days);

  const isSeller = view.role === "seller";

  // ponytail (R3.7): os KPIs monetários são uma SEGUNDA consulta, paralela em
  // dados mas sequencial em código — só para vendedor, e com o período que a
  // página já parseou. O `getDashboardMonetaryKPIs` já existia desde a Fase B
  // e não tinha consumidor; aqui ele alimenta a linha de resumo financeiro
  // que torna a taxa de 5% VISÍVEL para o vendedor.
  const monetary = isSeller
    ? await getDashboardMonetaryKPIs(drizzleAnalyticsRepository, session.user.id, {
        key: period as PeriodKey,
        days,
      })
    : null;

  return (
  <PageContainer size="default">
<PageHeader
        title={isSeller ? "Seu painel" : "Meus lances"}
        description={session.user.email}
        actions={<PeriodSelect current={period} />}
      />
      {isSeller ? (
        <SellerPanel view={view} period={period} monetary={monetary} />
      ) : (
        <BuyerPanel view={view} period={period} />
      )}
    </PageContainer>
  );
}
