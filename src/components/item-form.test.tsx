import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/presentation/actions/item-actions", () => ({
  createItemAction: vi.fn(),
  updateItemAction: vi.fn(),
}));
vi.mock("@/presentation/actions/upload-actions", () => ({ uploadItemImagesAction: vi.fn() }));

import { ItemForm } from "./item-form";

describe("ItemForm", () => {
  it("renderiza rótulos de todos os campos obrigatórios", () => {
    const html = renderToString(<ItemForm mode="create" />);
    expect(html).toContain("Título");
    expect(html).toContain("Descrição");
    expect(html).toContain("Lance mínimo (R$)");
    expect(html).toContain("Prazo para lances");
  });

  it("não marca aria-invalid em campo obrigatório ainda intocado", () => {
    const html = renderToString(<ItemForm mode="create" />);
    expect(html).toContain('id="title"');
    expect(html).not.toContain('aria-invalid="true"');
  });
});
