import { redirect } from "next/navigation";
import { BellOffIcon, Trash2Icon } from "lucide-react";
import { getSession } from "@/presentation/actions/auth-actions";
import {
  listNotificationsAction,
  markAllAsReadAction,
  markAsReadAction,
  deleteNotificationAction,
} from "@/presentation/actions/notification-actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";

// ponytail: como as demais páginas do dashboard, esta página NÃO renderiza o
// `DashboardHeader` — o `(dashboard)/layout.tsx` já o fornece (junto do
// `DashboardSidebar`). Renderizar de novo aqui duplicava o cabeçalho.
export const dynamic = "force-dynamic";

interface PageNotification {
  id: string;
  title: string;
  content: string;
  read: boolean;
  link: string | null;
  createdAt: Date | string;
}

function timeAgo(d: Date) {
  try {
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "agora";
    if (m < 60) return `há ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h}h`;
    const day = Math.floor(h / 24);
    return `há ${day}d`;
  } catch {
    return "";
  }
}

// ponytail: o CORPO da notificação não lida é um `<button type="submit">` —
// clicar em qualquer lugar da linha marca como lida, em vez de exigir a mira
// num botão pequeno à direita. O parágrafo do tempo carrega um sufixo
// `sr-only` ("marcar como lida") para o leitor de tela anunciar a AÇÃO junto
// com o conteúdo, em vez de deixar um botão gigante cujo nome acessível não
// diz o que ele faz.
//
// O botão de excluir é um IRMÃO do form de marcar, e não um filho do button:
// elemento interativo dentro de elemento interativo é HTML inválido, e o
// clique de apagar dispararia o marcar-como-lida junto.
function NotificationBody({ n }: { n: PageNotification }) {
  const title = n.read ? (
    <p className="text-sm">{n.title}</p>
  ) : (
    <p className="text-sm font-medium">{n.title}</p>
  );
  const meta = (
    <>
      <p className="mt-1 text-sm text-muted-foreground">{n.content}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {timeAgo(new Date(n.createdAt))}
        {!n.read && <span className="sr-only"> — marcar como lida</span>}
      </p>
      {/* ponytail (R7.1): o link é um `<Link>` seguro — o caminho vem do
          SERVIDOR (use case), não do usuário; e `Link` prefetcha a rota. */}
      {n.link ? (
        <Link href={n.link} className="mt-1 inline-block text-sm font-medium text-primary hover:underline">
          Ver detalhes →
        </Link>
      ) : null}
    </>
  );

  if (n.read) {
    return (
      <div>
        {title}
        {meta}
      </div>
    );
  }

  return (
    <form action={async () => { "use server"; await markAsReadAction(n.id); }}>
      <button type="submit" className="block w-full text-left" title="Marcar como lida">
        {title}
        {meta}
      </button>
    </form>
  );
}

/** Os três filtros, com aba ativa destacada — Links, não client state. */
const STATUS_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "unread", label: "Não lidas" },
  { key: "read", label: "Lidas" },
] as const;

function buildHref(status: string, page: number) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/dashboard/notifications${qs ? `?${qs}` : ""}`;
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const status = (sp.status === "read" || sp.status === "unread" ? sp.status : "all") as "all" | "read" | "unread";
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;
  const { items, total } = await listNotificationsAction({ status, limit, offset });
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <PageContainer size="wide">
      <PageHeader title="Notificações" description="Clique em uma notificação não lida para marcá-la como lida" />

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          {/* filtros de status + marcar todas — o design system de fato */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {STATUS_FILTERS.map((filter) => (
                <Button
                  key={filter.key}
                  nativeButton={false}
                  render={
                    <a
                      href={buildHref(filter.key, 1)}
                      aria-current={status === filter.key ? "page" : undefined}
                    />
                  }
                  variant={status === filter.key ? "default" : "outline"}
                  size="sm"
                >
                  {filter.label}
                </Button>
              ))}
              {status === "unread" && unreadCount > 0 ? (
                <Badge variant="secondary" className="ml-1">
                  {unreadCount}
                </Badge>
              ) : null}
            </div>
            <form action={markAllAsReadAction}>
              <Button type="submit" variant="ghost" size="sm" disabled={total === 0}>
                Marcar todas como lidas
              </Button>
            </form>
          </div>

          <Separator />

          {items.length === 0 ? (
            <EmptyState
              title="Nenhuma notificação"
              description={
                status === "unread"
                  ? "Você não tem notificações não lidas."
                  : status === "read"
                    ? "Você já leu todas as notificações deste filtro."
                    : "Assim que algo acontecer nos seus leilões, você será avisado aqui."
              }
              icon={<BellOffIcon aria-hidden="true" className="size-6 text-muted-foreground" />}
            />
          ) : (
            <ul className="divide-y">
              {items.map((n: PageNotification) => (
                <li key={n.id} className="flex items-start gap-3 py-3">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${
                      n.read ? "bg-transparent" : "bg-primary"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <NotificationBody n={n} />
                  </div>
                  <form action={async () => { "use server"; await deleteNotificationAction(n.id); }}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Excluir notificação: ${n.title}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages} · {total} notificaç{total === 1 ? "ão" : "ões"}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    nativeButton={false}
                    render={<a href={buildHref(status, Math.max(1, page - 1))} />}
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    nativeButton={false}
                    render={<a href={buildHref(status, Math.min(totalPages, page + 1))} />}
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
