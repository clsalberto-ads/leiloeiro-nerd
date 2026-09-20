import { describe, it, expect } from "vitest";
import { mapNotification } from "./drizzle-notification-repository";
import type { NotificationRow } from "./drizzle-notification-repository";

function makeRow(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: "n1",
    userId: "u1",
    type: "outbid",
    title: "Lance superado",
    content: "Seu lance foi superado.",
    read: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("drizzleNotificationRepository", () => {
  it("mapeia a linha do banco para a entidade Notification como o create faz", () => {
    const row = makeRow();
    const notification = mapNotification(row);
    expect(notification).toEqual({
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      content: row.content,
      read: row.read,
      createdAt: row.createdAt,
    });
  });

  it("preserva read como veio do banco (o create grava read=false)", () => {
    expect(mapNotification(makeRow({ read: false })).read).toBe(false);
  });

  it("aceita todos os tipos de notificação do enum", () => {
    const types: NotificationRow["type"][] = [
      "outbid",
      "won",
      "payment_due",
      "payment_expired",
      "payment_confirmed",
    ];
    for (const type of types) {
      expect(mapNotification(makeRow({ type })).type).toBe(type);
    }
  });
});