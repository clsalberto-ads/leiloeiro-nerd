import type { NotificationRepository } from "@/domain/repositories/notification-repository";

export async function markAsRead(notifRepo: NotificationRepository, id: string, userId: string) {
  await notifRepo.markAsRead(id, userId);
}

export async function markAllAsRead(notifRepo: NotificationRepository, userId: string) {
  await notifRepo.markAllAsRead(userId);
}

export async function markManyAsRead(notifRepo: NotificationRepository, ids: string[], userId: string) {
  await notifRepo.markManyAsRead(ids, userId);
}
