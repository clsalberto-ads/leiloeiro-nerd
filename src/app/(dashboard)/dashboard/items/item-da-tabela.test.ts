import { describe, expect, it } from "vitest";
import type { Item } from "@/domain/repositories/item-repository";
import { paraItemDaTabela, type ItemDaTabela } from "./item-da-tabela";

// ponytail: o `Item` de DOZE campos entra aqui inteiro de proposito — e o
// `description` longo e o `imageUrl` que a fronteira tem de nao deixar passar. Um
// teste que montasse o DTO ja sem os campos sobrando provaria que a funcao copia
// o que recebe, e nao que ela ESCOLHE.
const ITEM: Item = {
  id: "i1",
  sellerId: "u1",
  title: "Console retrô",
  description: "Console retrô completo com caixa, manuais e dois controles.",
  type: "product",
  imageUrl: "https://cdn.exemplo.test/console.webp",
  minInitialBid: 123456,
  minBidIncrement: 500,
  bidDeadline: new Date("2026-10-01T12:00:00Z"),
  paymentDeadlineDays: 3,
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T00:00:00Z"),
};

describe("item-da-tabela — a fronteira de serialização", () => {
  // ponytail: as CHAVES, e nao os valores. Este e o teste que trava a whitelist: um
  // `...resto` no lugar da copia campo a campo faria o `description` e o
  // `imageUrl` aparecerem no payload da navegacao — e, mais tarde, um campo novo do
  // `Item` entraria sem ninguem pedir. A lista de chaves e a ultima palavra sobre o
  // que a tela consome, entao o proximo `Item` novo quebra este teste em vez de
  // aumentar a tabela.
  it("entrega exatamente os seis campos que as colunas leem", () => {
    expect(Object.keys(paraItemDaTabela(ITEM)).sort()).toEqual([
      "bidDeadline",
      "id",
      "minInitialBid",
      "status",
      "title",
      "type",
    ]);
  });

  it("leva o valor de cada um, sem converter", () => {
    const dto = paraItemDaTabela(ITEM);

    expect(dto).toEqual<ItemDaTabela>({
      id: "i1",
      title: "Console retrô",
      type: "product",
      minInitialBid: 123456,
      bidDeadline: new Date("2026-10-01T12:00:00Z"),
      status: "active",
    });
    // ponytail: o `bidDeadline` segue sendo `Date` e nao texto. E o que a coluna
    // precisa: `toISOString()` no `datetime` do `<time>` e `toLocaleDateString` no
    // texto, e os dois sao metodos de `Date`. O React serializa `Date` no payload
    // do RSC (e nao e suposicao: o `items-list.test.tsx` renderiza a lista no
    // servidor e le a data no HTML, que e esse caminho) — o que nao atravessa e
    // classe com metodo, e nao e o caso do `Item`.
    expect(dto.bidDeadline).toBeInstanceOf(Date);
  });

  // ponytail: a pergunta e feita sobre as CHAVES (`Object.keys`), e nao sobre os
  // valores. O DTO nao tem assinatura de indice — ele nao e um dicionario, e um
  // mapa generico — entao `dto[campo]` nao compila, e o `as Record<string,
  // unknown>` que resolveria isso trocaria uma verificacao por uma promessa: a
  // partir do `as`, o teste passaria a aceitar QUALQUER objeto, inclusive um que
  // devolvesse o `Item` inteiro. Perguntar quais nomes existem nao tem essa
  // fragilidade — e o vazamento e sempre um nome a mais.
  it("nao deixa passar o texto longo, a imagem nem os campos de edição", () => {
    const chaves = Object.keys(paraItemDaTabela(ITEM));

    for (const foraDaTabela of [
      "description",
      "imageUrl",
      "sellerId",
      "minBidIncrement",
      "paymentDeadlineDays",
      "version",
      "winnerId",
      "highestBidId",
      "createdAt",
      "updatedAt",
    ]) {
      expect(chaves, `campo ${foraDaTabela} vazou para a tela`).not.toContain(foraDaTabela);
    }
  });
});
