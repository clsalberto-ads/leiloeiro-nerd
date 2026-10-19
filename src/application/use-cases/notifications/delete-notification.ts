import type { NotificationRepository } from "@/domain/repositories/notification-repository";

// ponytail: pass-through como o `markAsRead` do arquivo irmão — a regra que
// importa (só o dono apaga) vive no `WHERE` do repositório, não aqui. Existe
// como use case para a action não importar `src/infrastructure` direto (a
// seta da Clean Architecture), o mesmo motivo dos vizinhos desta pasta.
export async function deleteNotification(
  notifRepo: NotificationRepository,
  id: string,
  userId: string,
) {
  await notifRepo.delete(id, userId);
}
