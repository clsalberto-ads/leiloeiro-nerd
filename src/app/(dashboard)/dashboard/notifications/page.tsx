import { redirect } from "next/navigation";
import { getSession } from "@/presentation/actions/auth-actions";
import { listNotificationsAction, markAllAsReadAction, markAsReadAction } from "@/presentation/actions/notification-actions";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardHeader userName={session.user.name} />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <PageHeader title="Notificações" description="Suas notificações recentes" />
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
                  {items.map((n: { id: string; title: string; content: string; read: boolean; createdAt: Date | string }) => (
                    <li key={n.id} className="flex items-start justify-between gap-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{n.content}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{timeAgo(new Date(n.createdAt))}</p>
                      </div>
                      {!n.read && (
                        <form action={async () => {
                          "use server";
                          await markAsReadAction(n.id);
                        }}>
                          <Button type="submit" size="sm" variant="outline">
                            Marcar como lida
                          </Button>
                        </form>
                      )}
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
        </div>
      </main>
    </div>
  );
}
