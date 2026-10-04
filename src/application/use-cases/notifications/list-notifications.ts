import type { NotificationRepository } from "@/domain/repositories/notification-repository";

export async function listNotifications(
  notifRepo: NotificationRepository,
  userId: string,
  filters: { status?: "all" | "read" | "unread"; limit?: number; offset?: number } = {},
) {
  return notifRepo.listByUser(userId, filters);
}
