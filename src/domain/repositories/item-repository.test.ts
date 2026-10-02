import { describe, expect, it } from "vitest";
import type { ItemStatus, ItemType } from "./item-repository";
import { STATUS_LABELS, TYPE_LABELS } from "./item-repository";

// ponytail: as listas de membros sao escritas a mao de proposito, e e o unico jeito
// de o `tsc` dizer que o mapa ficou para tras. O `Record<ItemStatus, string>` ja
// quebra a compilacao quando um membro NOVO aparece (falta a chave), mas nao
// quando uma chave some: para isso precisa de uma lista independente com o
// conjunto esperado, e e a lista que este arquivo mantem. Duplicar o enum aqui e
// o preco de ter uma assercao que a leitura nao consegue cumprir sozinha — e o
// mesmo preco, e bem mais barato, da lista de abas.
const STATUS_MEMBERS: ItemStatus[] = [
  "draft",
  "active",
  "closed",
  "awaiting_payment",
  "paid",
  "cancelled",
];

const TYPE_MEMBERS: ItemType[] = ["product", "service", "piece"];

function withoutEmptyKeys(labels: Record<string, string>): string[] {
  return Object.entries(labels)
    .filter(([, label]) => label.trim() === "")
    .map(([key]) => key);
}

function duplicates(labels: Record<string, string>): string[] {
  const vistos = new Set<string>();
  const duplicates: string[] = [];
  for (const label of Object.values(labels)) {
    if (vistos.has(label)) duplicates.push(label);
    vistos.add(label);
  }
  return duplicates;
}

describe("o vocabulario canonico dos rotulos de item", () => {
  it("o mapa de status tem uma chave por membro do enum, e nenhuma sobra", () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...STATUS_MEMBERS].sort());
  });

  it("o mapa de tipo tem uma chave por membro do enum, e nenhuma sobra", () => {
    expect(Object.keys(TYPE_LABELS).sort()).toEqual([...TYPE_MEMBERS].sort());
  });

  it("todo status tem rotulo, e nenhum status divide o rotulo com outro", () => {
    expect(withoutEmptyKeys(STATUS_LABELS)).toEqual([]);
    expect(duplicates(STATUS_LABELS)).toEqual([]);
  });

  it("todo tipo tem rotulo, e nenhum tipo divide o rotulo com outro", () => {
    expect(withoutEmptyKeys(TYPE_LABELS)).toEqual([]);
    expect(duplicates(TYPE_LABELS)).toEqual([]);
  });

  // ponytail: os dois mapas sao lidos juntos porque a busca e lida junto: e o `q`
  // que casa com titulo OU rotulo de status OU rotulo de tipo. Um rotulo que
  // aparecesse nos dois mapas nao quebraria nada (o `CASE` do SQL continua
  // correto), mas faria a busca devolver a linha por um motivo que o usuario nao
  // consegue distinguir — "Pago" bate em um status E em um tipo, e a resposta
  // parece mais larga do que o texto digitado. A distincao e o que faz a busca
  // continuar sendo legivel como lista de resultados.
  it("nenhum rotulo de status e o mesmo texto que um rotulo de tipo", () => {
    const tipos = new Set(Object.values(TYPE_LABELS));
    const emComum = Object.values(STATUS_LABELS).filter((label) => tipos.has(label));
    expect(emComum).toEqual([]);
  });
});
