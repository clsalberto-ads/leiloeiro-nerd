export interface Notification {
  id: string;
  userId: string;
  type: "outbid" | "won" | "payment_due" | "payment_expired" | "payment_confirmed";
  title: string;
  content: string;
  read: boolean;
  createdAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  type: Notification["type"];
  title: string;
  content: string;
}

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<Notification>;
  getUnreadCount(userId: string): Promise<number>;
  listRecent(userId: string, limit: number): Promise<Notification[]>;
  listByUser(
    userId: string,
    filters: { status?: "all" | "read" | "unread"; limit?: number; offset?: number },
  ): Promise<{ items: Notification[]; total: number }>;
  countByUser(userId: string, filters: { status?: "all" | "read" | "unread" }): Promise<number>;
  markAsRead(id: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  markManyAsRead(ids: string[], userId: string): Promise<void>;
  /**
   * Apaga UMA notificação, e só do dono.
   *
   * ponytail: o `userId` no contrato (e no `WHERE` da implementação) é o que
   * impede um POST forjado de apagar a notificação de outra pessoa — o mesmo
   * invariante de `markAsRead`, que também é uma escrita escopada por dono.
   * Sem efeito se o id não existir OU não pertencer ao usuário: apagar é
   * idempotente por natureza, não há erro a distinguir.
   */
  delete(id: string, userId: string): Promise<void>;
}
