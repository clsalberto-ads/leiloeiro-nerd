import type { NotificationRepository } from "@/domain/repositories/notification-repository";

export async function listRecentNotifications(notifRepo: NotificationRepository, userId: string, limit = 5) {
  return notifRepo.listRecent(userId, limit);
}
