import { describe, expect, it } from "vitest";
import type { ItemStatus, ItemType } from "./item-repository";
import { ROTULO_STATUS, ROTULO_TIPO } from "./item-repository";

// ponytail: as listas de membros sao escritas a mao de proposito, e e o unico jeito
// de o `tsc` dizer que o mapa ficou para tras. O `Record<ItemStatus, string>` ja
// quebra a compilacao quando um membro NOVO aparece (falta a chave), mas nao
// quando uma chave some: para isso precisa de uma lista independente com o
// conjunto esperado, e e a lista que este arquivo mantem. Duplicar o enum aqui e
// o preco de ter uma assercao que a leitura nao consegue cumprir sozinha — e o
// mesmo preco, e bem mais barato, da lista de abas.
const MEMBROS_DE_STATUS: ItemStatus[] = [
  "draft",
  "active",
  "closed",
  "awaiting_payment",
  "paid",
  "cancelled",
];

const MEMBROS_DE_TIPO: ItemType[] = ["product", "service", "piece"];

function semChavesVazias(rotulos: Record<string, string>): string[] {
  return Object.entries(rotulos)
    .filter(([, rotulo]) => rotulo.trim() === "")
    .map(([chave]) => chave);
}

function repetidos(rotulos: Record<string, string>): string[] {
  const vistos = new Set<string>();
  const repetidos: string[] = [];
  for (const rotulo of Object.values(rotulos)) {
    if (vistos.has(rotulo)) repetidos.push(rotulo);
    vistos.add(rotulo);
  }
  return repetidos;
}

describe("o vocabulario canonico dos rotulos de item", () => {
  it("o mapa de status tem uma chave por membro do enum, e nenhuma sobra", () => {
    expect(Object.keys(ROTULO_STATUS).sort()).toEqual([...MEMBROS_DE_STATUS].sort());
  });

  it("o mapa de tipo tem uma chave por membro do enum, e nenhuma sobra", () => {
    expect(Object.keys(ROTULO_TIPO).sort()).toEqual([...MEMBROS_DE_TIPO].sort());
  });

  it("todo status tem rotulo, e nenhum status divide o rotulo com outro", () => {
    expect(semChavesVazias(ROTULO_STATUS)).toEqual([]);
    expect(repetidos(ROTULO_STATUS)).toEqual([]);
  });

  it("todo tipo tem rotulo, e nenhum tipo divide o rotulo com outro", () => {
    expect(semChavesVazias(ROTULO_TIPO)).toEqual([]);
    expect(repetidos(ROTULO_TIPO)).toEqual([]);
  });

  // ponytail: os dois mapas sao lidos juntos porque a busca e lida junto: e o `q`
  // que casa com titulo OU rotulo de status OU rotulo de tipo. Um rotulo que
  // aparecesse nos dois mapas nao quebraria nada (o `CASE` do SQL continua
  // correto), mas faria a busca devolver a linha por um motivo que o usuario nao
  // consegue distinguir — "Pago" bate em um status E em um tipo, e a resposta
  // parece mais larga do que o texto digitado. A distincao e o que faz a busca
  // continuar sendo legivel como lista de resultados.
  it("nenhum rotulo de status e o mesmo texto que um rotulo de tipo", () => {
    const tipos = new Set(Object.values(ROTULO_TIPO));
    const emComum = Object.values(ROTULO_STATUS).filter((rotulo) => tipos.has(rotulo));
    expect(emComum).toEqual([]);
  });
});
