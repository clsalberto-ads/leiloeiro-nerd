// ponytail (R2.6): skeleton de carregamento do dashboard. O que o usuário vê
// entre clicar num link e o `force-dynamic` responder. Mesma SILHUETA da
// página real (header + indicadores + gráfico) para não "pular" quando chegar.
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";

export default function DashboardLoading() {
  return (
    <PageContainer>
      <PageHeader title="Seu painel" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-20" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[260px] w-full" />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
