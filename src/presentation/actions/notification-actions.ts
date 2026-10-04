"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/presentation/actions/auth-actions";
import { drizzleNotificationRepository } from "@/infrastructure/database/repositories/drizzle-notification-repository";
import { listRecentNotifications } from "@/application/use-cases/notifications/list-recent-notifications";
import { getUnreadCount } from "@/application/use-cases/notifications/get-unread-count";
import { drizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository";
import {
  markAsRead,
  markAllAsRead,
  markManyAsRead,
} from "@/application/use-cases/notifications/mark-notifications-read";
import { listNotifications } from "@/application/use-cases/notifications/list-notifications";

export async function getUnreadCountAction() {
  const session = await getSession();
  if (!session) return 0;
  return getUnreadCount(drizzleUserRepository, drizzleNotificationRepository, session.user.id);
}

export async function listRecentNotificationsAction(limit = 5) {
  const session = await getSession();
  if (!session) return [];
  return listRecentNotifications(drizzleNotificationRepository, session.user.id, limit);
}

export async function markAsReadAction(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");
  await markAsRead(drizzleNotificationRepository, id, session.user.id);
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}

export async function markAllAsReadAction() {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");
  await markAllAsRead(drizzleNotificationRepository, session.user.id);
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}

export async function markManyAsReadAction(ids: string[]) {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");
  await markManyAsRead(drizzleNotificationRepository, ids, session.user.id);
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}

export async function listNotificationsAction(
  filters: { status?: "all" | "read" | "unread"; limit?: number; offset?: number } = {},
) {
  const session = await getSession();
  if (!session) return { items: [], total: 0 };
  return listNotifications(drizzleNotificationRepository, session.user.id, filters);
}
