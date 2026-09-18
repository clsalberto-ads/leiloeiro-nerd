import { describe, it, expect, beforeEach } from "vitest";
import { drizzleNotificationRepository } from "./drizzle-notification-repository";

type Notification = {
  id: string;
  userId: string;
  type: "outbid" | "won" | "payment_due" | "payment_expired" | "payment_confirmed";
  title: string;
  content: string;
  read: boolean;
  createdAt: Date;
};

type CreateNotificationInput = {
  userId: string;
  type: "outbid" | "won" | "payment_due" | "payment_expired" | "payment_confirmed";
  title: string;
  content: string;
};

function createFakeNotificationRepository() {
  const store = new Map<string, Notification[]>();

  return {
    async create(input: CreateNotificationInput): Promise<Notification> {
      const userNotifications = store.get(input.userId) ?? [];

      const notification: Notification = {
        id: crypto.randomUUID(),
        userId: input.userId,
        type: input.type,
        title: input.title,
        content: input.content,
        read: false,
        createdAt: new Date(),
      };

      store.set(input.userId, [...userNotifications, notification]);

      return notification;
    },

    _reset() {
      store.clear();
    },
  };
}

describe("drizzleNotificationRepository (fake)", () => {
  let repo: ReturnType<typeof createFakeNotificationRepository>;

  beforeEach(() => {
    repo = createFakeNotificationRepository();
  });

  it("create notification returns correct fields", async () => {
    const notification = await repo.create({
      userId: "user-1",
      type: "outbid",
      title: "You've been outbid!",
      content: "Someone placed a higher bid on your item.",
    });

    expect(notification.id).toBeDefined();
    expect(notification.userId).toBe("user-1");
    expect(notification.type).toBe("outbid");
    expect(notification.title).toBe("You've been outbid!");
    expect(notification.content).toBe("Someone placed a higher bid on your item.");
    expect(notification.read).toBe(false);
    expect(notification.createdAt).toBeInstanceOf(Date);
  });

  it("read defaults to false", async () => {
    const notification = await repo.create({
      userId: "user-1",
      type: "won",
      title: "You won!",
      content: "Congratulations on winning the auction.",
    });

    expect(notification.read).toBe(false);
  });

  it("create notification with different types", async () => {
    const types = ["outbid", "won", "payment_due", "payment_expired", "payment_confirmed"] as const;

    for (const type of types) {
      const notification = await repo.create({
        userId: "user-1",
        type,
        title: `Title for ${type}`,
        content: `Content for ${type}`,
      });

      expect(notification.type).toBe(type);
      expect(notification.read).toBe(false);
    }
  });
});