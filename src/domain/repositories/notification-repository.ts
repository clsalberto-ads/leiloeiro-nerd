export interface Notification {
  id: string;
  userId: string;
  // ponytail: `next_bidder_called` é a notificação da CASCATA de pagamentos
  // (Fase 3): o arrematante anterior não pagou e o próximo da fila foi chamado.
  type:
    | "outbid"
    | "won"
    | "payment_due"
    | "payment_expired"
    | "payment_confirmed"
    | "next_bidder_called";
  title: string;
  content: string;
  read: boolean;
  /** (R7.1) Destino clicável — `/dashboard/payments/{id}`, ou a vitrine. Null = texto só. */
  link: string | null;
  createdAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  type: Notification["type"];
  title: string;
  content: string;
  /** (R7.1) O caminho clicável, quando a notificação tem para onde levar. */
  link?: string;
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
