import { type InferSelectModel } from "drizzle-orm";
import { db } from "@/infrastructure/database/drizzle";
import { notifications } from "@/infrastructure/database/schema";
import type { NotificationRepository, CreateNotificationInput, Notification } from "@/domain/repositories/notification-repository";

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
  };
}

export const drizzleNotificationRepository: NotificationRepository = {
  async create(input: CreateNotificationInput): Promise<Notification> {
    const [row] = await db
      .insert(notifications)
      .values({ ...input, read: false })
      .returning();

    return mapNotification(row!);
  },
};