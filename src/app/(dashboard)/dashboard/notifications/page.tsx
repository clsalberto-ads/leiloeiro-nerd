import { redirect } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { getSession } from "@/presentation/actions/auth-actions";
import { listNotificationsAction, markAllAsReadAction, markAsReadAction, deleteNotificationAction } from "@/presentation/actions/notification-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";

// ponytail: como as demais páginas do dashboard, esta página NÃO renderiza o
// `DashboardHeader` — o `(dashboard)/layout.tsx` já o fornece (junto do
// `DashboardSidebar`). Renderizar de novo aqui duplicava o cabeçalho.
export const dynamic = "force-dynamic";

interface PageNotification {
  id: string;
  title: string;
  content: string;
  read: boolean;
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

  return (
    <PageContainer size="wide">
<PageHeader
            title="Notificações"
            description="Clique em uma notificação não lida para marcá-la como lida"
          />
          <Card>
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <Link href="/dashboard/notifications?status=all&page=1" className="inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-sm hover:bg-muted">Todas</Link>
                  <Link href="/dashboard/notifications?status=unread&page=1" className="inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-sm hover:bg-muted">Não lidas</Link>
                  <Link href="/dashboard/notifications?status=read&page=1" className="inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-sm hover:bg-muted">Lidas</Link>
                </div>
                <form action={markAllAsReadAction}>
                  <Button type="submit" variant="ghost" size="sm">
                    Marcar todas como lidas
                  </Button>
                </form>
              </div>
              {items.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma notificação</div>
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
                <div className="flex items-center justify-end gap-2">
                  <Link href={page <= 1 ? "/dashboard/notifications?status="+status+"&page="+page : "/dashboard/notifications?status="+status+"&page="+(page-1)} className={page <= 1 ? "pointer-events-none inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-sm opacity-50" : "inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-sm hover:bg-muted"}>Anterior</Link>
                  <span className="text-xs text-muted-foreground">
                    {page}/{totalPages}
                  </span>
                  <Link href={page >= totalPages ? "/dashboard/notifications?status="+status+"&page="+page : "/dashboard/notifications?status="+status+"&page="+(page+1)} className={page >= totalPages ? "pointer-events-none inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-sm opacity-50" : "inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-sm hover:bg-muted"}>Próxima</Link>
                </div>
              )}
            </CardContent>
          </Card>
      </PageContainer>
  );
}
