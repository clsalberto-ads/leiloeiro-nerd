"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  getUnreadCountAction,
  listRecentNotificationsAction,
  markAllAsReadAction,
  markManyAsReadAction,
} from "@/presentation/actions/notification-actions";
import type { Notification } from "@/domain/repositories/notification-repository";
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

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [isPending, startTransition] = useTransition();

  async function load() {
    startTransition(async () => {
      const [c, list] = await Promise.all([getUnreadCountAction(), listRecentNotificationsAction(5)]);
      setCount(c);
      setItems(list as Notification[]);
    });
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (open && items.length > 0) {
      const ids = items.filter((i) => !i.read).map((i) => i.id);
      if (ids.length > 0) {
        startTransition(async () => {
          await markManyAsReadAction(ids);
          setCount((prev) => Math.max(0, prev - ids.length));
          setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, read: true } : i)));
        });
      }
    }
  }, [open, items]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) => (
          <button
            {...props}
            className="relative inline-flex h-9 items-center justify-center rounded-md px-2 text-sm hover:bg-accent"
            aria-label="Notificações"
          >
            <Bell className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
        )}
      />
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Notificações</p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                startTransition(async () => {
                  await markAllAsReadAction();
                  setCount(0);
                  setItems((prev) => prev.map((i) => ({ ...i, read: true })));
                })
              }
              disabled={isPending || count === 0}
            >
              Ler todas
            </Button>
            <Link href="/dashboard/notifications" className="inline-flex h-7 items-center justify-center rounded-md px-2.5 text-sm hover:bg-muted">
              Ver todas
            </Link>
          </div>
        </div>
        <div className="max-h-80 overflow-auto">
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma notificação</div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id} className="p-3 hover:bg-accent/50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.content}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
