import { describe, expect, it } from "vitest";
import { deleteNotification } from "./delete-notification";
import type {
  CreateNotificationInput,
  Notification,
  NotificationRepository,
} from "@/domain/repositories/notification-repository";

// Fake com MÉTRICA de chamada: o `deleteNotification` é um pass-through, e o
// contrato que vale testar é o PAR que desce ao repositório — (id, userId).
// Se um dia o use case ganhar regra própria (auditoria, soft-delete), é este
// teste que avisa que o par deixou de chegar inteiro.
class FakeNotificationRepository implements NotificationRepository {
  deletions: Array<{ id: string; userId: string }> = [];
  // A anotação explícita é porque `implements` NÃO fornece tipagem contextual
  // para inferência: um `async create() { throw }` solto seria inferido como
  // `Promise<void>` e o tsc reprovaria a classe inteira.
  async create(_input: CreateNotificationInput): Promise<Notification> {
    throw new Error("fora de escopo");
  }
  async getUnreadCount() { return 0; }
  async listRecent() { return [] as Notification[]; }
  async listByUser() { return { items: [] as Notification[], total: 0 }; }
  async countByUser() { return 0; }
  async markAsRead() {}
  async markAllAsRead() {}
  async markManyAsRead() {}
  async delete(id: string, userId: string) {
    this.deletions.push({ id, userId });
  }
}

describe("deleteNotification", () => {
  it("desce ao repositório com o par (id, userId) — o dono é quem decide apagar", async () => {
    const repo = new FakeNotificationRepository();

    await deleteNotification(repo, "n1", "u1");

    expect(repo.deletions).toEqual([{ id: "n1", userId: "u1" }]);
  });
});
