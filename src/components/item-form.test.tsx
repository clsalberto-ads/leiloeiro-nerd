import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/presentation/actions/item-actions", () => ({
  createItemAction: vi.fn(),
  updateItemAction: vi.fn(),
}));
vi.mock("@/presentation/actions/upload-actions", () => ({ uploadItemImagesAction: vi.fn() }));

import { ItemForm } from "./item-form";
import type { Item } from "@/domain/repositories/item-repository";

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-123",
    sellerId: "seller-1",
    title: "Fone de ouvido",
    description: "Fone bluetooth em ótimo estado",
    type: "product",
    imageUrl: null,
    minInitialBid: 1000,
    minBidIncrement: 500,
    bidDeadline: new Date("2026-12-01T12:00:00.000Z"),
    paymentDeadlineDays: 3,
    status: "active",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

function tagOf(html: string, id: string): string {
  const tag = html.match(new RegExp(`<[a-z]+[^>]*\\sid="${id}"[^>]*>`))?.[0];
  expect(tag, `nenhuma tag com id="${id}" no HTML renderizado`).toBeDefined();
  return tag!;
}

describe("ItemForm", () => {
  it("renderiza rótulos de todos os campos obrigatórios", () => {
    const html = renderToString(<ItemForm mode="create" />);
    expect(html).toContain("Título");
    expect(html).toContain("Descrição");
    expect(html).toContain("Lance mínimo (R$)");
    expect(html).toContain("Prazo para lances");
  });

  it("liga o rótulo ao input pelo mesmo id e registra o campo no RHF", () => {
    const html = renderToString(<ItemForm mode="create" />);
    const labelFor = html.match(/for="([^"]+)"[^>]*>Título</)?.[1];
    expect(labelFor).toBe("title");
    const input = tagOf(html, "title");
    expect(input).toContain('name="title"');
    expect(input).toContain('required=""');
    // render props do Field atravessando ui/input.tsx -> base-ui FieldControl
    expect(input).toContain('aria-invalid="false"');
  });

  it("bloqueia a edição e sinaliza com data-disabled quando o item não é rascunho", () => {
    const html = renderToString(<ItemForm item={item({ status: "active" })} mode="edit" />);
    expect(html).toContain('data-disabled="true"');
    expect(tagOf(html, "title")).toContain('disabled=""');
    expect(tagOf(html, "description")).toContain('disabled=""');
    expect(tagOf(html, "type")).toContain('disabled=""');
    expect(html).toContain("Item publicado — edição bloqueada.");
  });

  it("não bloqueia a edição de rascunho", () => {
    const html = renderToString(<ItemForm item={item({ status: "draft" })} mode="edit" />);
    expect(html).not.toContain('data-disabled="true"');
    expect(tagOf(html, "title")).not.toContain('disabled=""');
  });

  it("envia imageUrls como input hidden e o id do item só na edição", () => {
    const create = renderToString(<ItemForm mode="create" />);
    expect(create).toContain('<input type="hidden" name="imageUrls" value="[]"/>');
    expect(create).not.toContain('name="id"');

    const edit = renderToString(<ItemForm item={item()} mode="edit" />);
    expect(edit).toContain('<input type="hidden" name="id" value="item-123"/>');
    expect(edit).toContain('<input type="hidden" name="imageUrls" value="[]"/>');
  });

  it("mantém o tipo do item e cai para product sem item", () => {
    const create = renderToString(<ItemForm mode="create" />);
    expect(create).toContain('<option value="product" selected="">');

    const edit = renderToString(<ItemForm item={item({ type: "service" })} mode="edit" />);
    expect(edit).toContain('<option value="service" selected="">');
    expect(edit).not.toContain('<option value="product" selected="">');
  });
});
