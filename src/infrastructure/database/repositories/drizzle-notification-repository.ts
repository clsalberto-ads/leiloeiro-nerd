import { type InferSelectModel, eq, and, desc, asc, count, inArray } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { notifications } from "@/infrastructure/database/schema";
import type {
  NotificationRepository,
  CreateNotificationInput,
  Notification,
} from "@/domain/repositories/notification-repository";

export type NotificationRow = InferSelectModel<typeof notifications>;

export function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    content: row.content,
    read: row.read,
    createdAt: row.createdAt,
  } satisfies Notification;
}

export const drizzleNotificationRepository: NotificationRepository = {
  async create(input: CreateNotificationInput): Promise<Notification> {
    const [row] = await db
      .insert(notifications)
      .values({ ...input, read: false })
      .returning();
    return mapNotification(row!);
  },
  async getUnreadCount(userId: string): Promise<number> {
    const [r] = await db
      .select({ c: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return Number(r?.c ?? 0);
  },
  async listRecent(userId: string, limit: number): Promise<Notification[]> {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(asc(notifications.read), desc(notifications.createdAt))
      .limit(limit);
    return rows as Notification[];
  },
  async countByUser(userId: string, filters: { status?: "all" | "read" | "unread" } = {}): Promise<number> {
    const { status = "all" } = filters;
    const where = [eq(notifications.userId, userId)];
    if (status === "unread") where.push(eq(notifications.read, false));
    if (status === "read") where.push(eq(notifications.read, true));
    const [r] = await db.select({ c: count() }).from(notifications).where(and(...where));
    return Number(r?.c ?? 0);
  },
  async listByUser(
    userId: string,
    filters: { status?: "all" | "read" | "unread"; limit?: number; offset?: number } = {},
  ): Promise<{ items: Notification[]; total: number }> {
    const { status = "all", limit = 50, offset = 0 } = filters;
    const where = [eq(notifications.userId, userId)];
    if (status === "unread") where.push(eq(notifications.read, false));
    if (status === "read") where.push(eq(notifications.read, true));
    const [rows, [tot]] = await Promise.all([
      db
        .select()
        .from(notifications)
        .where(and(...where))
        .orderBy(asc(notifications.read), desc(notifications.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ c: count() }).from(notifications).where(and(...where)),
    ]);
    return { items: rows as Notification[], total: Number(tot?.c ?? 0) };
  },
  async markAsRead(id: string, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  },
  async markAllAsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
  },
  async markManyAsRead(ids: string[], userId: string): Promise<void> {
    if (ids.length === 0) return;
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(inArray(notifications.id, ids), eq(notifications.userId, userId)));
  },
};
