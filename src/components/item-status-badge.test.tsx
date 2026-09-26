import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { ItemStatus } from "@/domain/repositories/item-repository";
import { ItemStatusBadge } from "./item-status-badge";

const STATUS: ItemStatus[] = ["draft", "active", "closed", "awaiting_payment", "paid", "cancelled"];

const ESPERADO: Record<ItemStatus, { label: string; classes: string }> = {
  draft: { label: "Rascunho", classes: "bg-muted text-muted-foreground" },
  active: { label: "Em leilão", classes: "bg-emerald-100 text-emerald-800" },
  closed: { label: "Encerrado", classes: "bg-sky-100 text-sky-800" },
  awaiting_payment: { label: "Aguardando pagamento", classes: "bg-amber-100 text-amber-800" },
  paid: { label: "Pago", classes: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Cancelado", classes: "bg-destructive/10 text-destructive" },
};

describe("ItemStatusBadge", () => {
  it.each(STATUS)("mantem o rotulo pt-BR e as classes de cor do status %s", (status) => {
    const { label, classes } = ESPERADO[status];
    const html = renderToString(<ItemStatusBadge status={status} />);
    expect(html).toContain(`>${label}</span>`);
    for (const classe of classes.split(" ")) {
      expect(html, `classe ${classe} ausente no badge de ${status}`).toContain(classe);
    }
    expect(html, `string de classes "${classes}" ausente no badge de ${status}`).toContain(classes);
  });

  it("renderiza o Badge do shadcn, nao um span montado a mao", () => {
    for (const status of STATUS) {
      expect(renderToString(<ItemStatusBadge status={status} />)).toContain('data-slot="badge"');
    }
  });
});
