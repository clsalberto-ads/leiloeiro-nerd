export type NotificationType = "outbid" | "won" | "payment_due" | "payment_expired" | "payment_confirmed";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  read: boolean;
  createdAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
}

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<Notification>;
}