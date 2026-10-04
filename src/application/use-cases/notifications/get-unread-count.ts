import type { NotificationRepository } from "@/domain/repositories/notification-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";

export async function getUnreadCount(
  userRepo: Pick<UserRepository, "findById">,
  notifRepo: NotificationRepository,
  userId: string,
) {
  const user = await userRepo.findById(userId);
  if (!user) return 0;
  return notifRepo.getUnreadCount(userId);
}
