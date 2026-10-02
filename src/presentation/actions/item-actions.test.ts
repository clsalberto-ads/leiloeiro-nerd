import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  // o `redirect` lanca de proposito (e o que o Next faz); o destino nao e
  // assertado aqui porque o que importa nestas actions e o guarda ANTES dele
  redirect: vi.fn((target: string): never => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
  updateItem: vi.fn(),
  publishItem: vi.fn(),
  cancelItem: vi.fn(),
  deleteItem: vi.fn(),
}));

vi.mock("./auth-actions", () => ({ getSession: mocks.getSession }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: mocks.redirect,
}));
vi.mock("@/application/use-cases/update-item", () => ({ updateItem: mocks.updateItem }));
vi.mock("@/application/use-cases/publish-item", () => ({ publishItem: mocks.publishItem }));
vi.mock("@/application/use-cases/cancel-item", () => ({ cancelItem: mocks.cancelItem }));
vi.mock("@/application/use-cases/delete-item", () => ({ deleteItem: mocks.deleteItem }));
vi.mock("@/infrastructure/database/repositories/drizzle-item-repository", () => ({
  drizzleItemRepository: {},
}));
vi.mock("@/infrastructure/database/repositories/drizzle-user-repository", () => ({
  drizzleUserRepository: {},
}));

import { cancelItemAction, deleteItemAction, publishItemAction, updateItemAction } from "./item-actions";

const UUID_VALIDO = "0b61e95c-2be1-4d38-8f74-3c5a3a1c8f3a";

const ITEM_VALIDO = {
  title: "Action Figure rara",
  description: "Colecionável lacrado, edição limitada.",
  type: "product",
  minInitialBid: "50.00",
  minBidIncrement: "5.00",
  bidDeadline: new Date(Date.now() + 86_400_000).toISOString(),
};

function form(id: string, extras: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("id", id);
  for (const [k, v] of Object.entries({ ...ITEM_VALIDO, ...extras })) fd.set(k, v);
  return fd;
}

describe("actions de item — guarda de id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "u1" } });
  });

  // ponytail: o `id` era o UNICO campo destas actions que nao passava pelo Zod
  // (`String(formData.get("id") ?? "")`), e `items.id` e `uuid`. Um id
  // adulterado estourava `invalid input syntax for type uuid` do Postgres dentro
  // do `findById` — antes do check de propriedade — e o `catch` devolvia esse
  // texto ao navegador, com o SQL junto. Um POST a mao reachava; a UI nao. E o
  // throw no `publishItem` escapava da action INTEIRA (o `redirect` esta fora do
  // try), virando erro de boundary em vez de mensagem de campo.
  it.each([
    ["update", updateItemAction, mocks.updateItem],
    ["publish", publishItemAction, mocks.publishItem],
    ["cancel", cancelItemAction, mocks.cancelItem],
    ["delete", deleteItemAction, mocks.deleteItem],
  ])("%s recusa id fora do formato uuid sem tocar no use case", async (_name, action, useCase) => {
    for (const ruim of ["x", "1; DROP TABLE items", "../../etc/passwd", "0b61e95c-2be1-4d38-8f74", ""]) {
      const r = await action(null, form(ruim));
      expect(r).toEqual({ error: "Item inválido" });
    }
    expect(useCase).not.toHaveBeenCalled();
  });

  it("update ainda valida o corpo antes de chamar o use case", async () => {
    // id ok, corpo invalido: o erro tem de ser o do campo, nao o do id
    const r = await updateItemAction(null, form(UUID_VALIDO, { title: "x" }));
    expect(r.error).toBeDefined();
    expect(r.error).not.toBe("Item inválido");
    expect(mocks.updateItem).not.toHaveBeenCalled();
  });

  // ponytail: `toActionError` distingue o erro de NOSSO codigo (que o usuario
  // pode corrigir: "Item com lances nao pode ser excluido") do erro de DRIVER
  // (que traz o SQL do `pg`: `Failed query: delete from "items" ... params: i1`,
  // `permission denied for schema user`, `ECONNREFUSED host:port`). O `code` que
  // o driver anexa e a marca. O `23503` abaixo e uma violacao de FK de verdade —
  // a corrida entre `deleteItem` e um lance concorrente — e ela NAO pode virar
  // SQL na tela.
  it("nao devolve a mensagem do driver ao usuario", async () => {
    mocks.cancelItem.mockRejectedValue(
      Object.assign(new Error('Failed query: delete from "items" params: i1'), { code: "23503" }),
    );
    const r = await cancelItemAction(null, form(UUID_VALIDO));
    expect(r.error).toBe("Não foi possível cancelar o item.");
    expect(r.error).not.toContain("Failed query");
    expect(r.error).not.toContain("params:");
  });

  it("repassa a mensagem de negocio do use case, que o usuario pode corrigir", async () => {
    mocks.cancelItem.mockRejectedValue(new Error("Item não encontrado"));
    const r = await cancelItemAction(null, form(UUID_VALIDO));
    expect(r.error).toBe("Item não encontrado");
  });

  it("nao autenticado e barrado antes de qualquer consulta", async () => {
    mocks.getSession.mockResolvedValue(null);
    for (const [, action] of [
      ["update", updateItemAction, mocks.updateItem],
      ["publish", publishItemAction, mocks.publishItem],
      ["cancel", cancelItemAction, mocks.cancelItem],
      ["delete", deleteItemAction, mocks.deleteItem],
    ] as const) {
      await expect(action(null, form(UUID_VALIDO))).resolves.toEqual({ error: "Não autenticado" });
    }
    expect(mocks.updateItem).not.toHaveBeenCalled();
    expect(mocks.publishItem).not.toHaveBeenCalled();
    expect(mocks.cancelItem).not.toHaveBeenCalled();
    expect(mocks.deleteItem).not.toHaveBeenCalled();
  });
});
