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

// Tokens de cor do variant "default" do Badge do shadcn. Eles nao aparecem no
// badge renderizado porque o `cn` (tailwind-merge) descarta o `bg-primary` e o
// `text-primary-foreground` em favor das classes de cor do status.
const DO_VARIANT_DEFAULT = ["bg-primary", "text-primary-foreground"];

// ponytail: tokenizar e obrigatorio, e nao cosmico. Um
// `not.toContain("bg-primary")` no HTML cru acusaria falso positivo: o
// `[a]:hover:bg-primary/80` do variant default sobrevive ao merge (sao 31
// tokens no badge, 30 da base + 1 de cor do status) e contem essa substring.
// Sobre o HTML inteiro, `toContain(classe)` tambem aceitaria a substring de um
// token vizinho. Comparando tokens exatos, presenca e ausencia ficam corretas
// e a mensagem de falha mostra o class inteiro.
function classesDo(html: string): string[] {
  const atributo = /class="([^"]*)"/.exec(html);
  expect(atributo, "badge renderizado sem atributo class").not.toBeNull();
  return atributo![1].split(" ");
}

describe("ItemStatusBadge", () => {
  it.each(STATUS)("mantem o rotulo pt-BR e as classes de cor do status %s", (status) => {
    const { label, classes } = ESPERADO[status];
    const html = renderToString(<ItemStatusBadge status={status} />);
    const tokens = classesDo(html);
    expect(html).toContain(`>${label}</span>`);
    for (const classe of classes.split(" ")) {
      expect(tokens, `classe ${classe} ausente no badge de ${status}`).toContain(classe);
    }
  });

  it.each(STATUS)("descarta os tokens de cor do variant default no status %s", (status) => {
    const tokens = classesDo(renderToString(<ItemStatusBadge status={status} />));
    for (const classe of DO_VARIANT_DEFAULT) {
      expect(
        tokens,
        `token ${classe} do variant default sobreviveu ao merge no badge de ${status}`,
      ).not.toContain(classe);
    }
  });

  it("renderiza o Badge do shadcn, nao um span montado a mao", () => {
    for (const status of STATUS) {
      expect(renderToString(<ItemStatusBadge status={status} />)).toContain('data-slot="badge"');
    }
  });
});
