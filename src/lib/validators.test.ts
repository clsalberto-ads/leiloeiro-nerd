import { describe, expect, it } from "vitest";
import { becomeSellerSchema, bidFormSchema, imageUploadSchema, itemSchema, placeBidSchema } from "./validators";

const img = (size: number) => new File([new ArrayBuffer(size)], "a.jpg", { type: "image/jpeg" });

describe("imageUploadSchema", () => {
  it("aceita até 10 imagens de até 8MB", () => {
    expect(imageUploadSchema.safeParse({ images: Array.from({ length: 10 }, () => img(1024)) }).success).toBe(true);
  });

  it("rejeita mais de 10 imagens", () => {
    expect(imageUploadSchema.safeParse({ images: Array.from({ length: 11 }, () => img(1024)) }).success).toBe(false);
  });

  it("rejeita imagem maior que 8MB", () => {
    expect(imageUploadSchema.safeParse({ images: [img(8 * 1024 * 1024 + 1)] }).success).toBe(false);
  });

  it("rejeita arquivo que não é imagem", () => {
    const txt = new File(["x"], "a.txt", { type: "text/plain" });
    expect(imageUploadSchema.safeParse({ images: [txt] }).success).toBe(false);
  });
});

describe("itemSchema", () => {
  const base = {
    title: "Action Figure rara",
    description: "Colecionável lacrado em estojo.",
    type: "product",
    minInitialBid: "50.00",
    minBidIncrement: "5.00",
    bidDeadline: new Date(Date.now() + 86400000).toISOString(),
  };

  it("aceita dados válidos e converte reais para centavos", () => {
    const result = itemSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minInitialBid).toBe(5000);
      expect(result.data.minBidIncrement).toBe(500);
      expect(result.data.paymentDeadlineDays).toBe(3);
    }
  });

  it("rejeita deadline no passado", () => {
    expect(
      itemSchema.safeParse({
        title: "Action Figure rara",
        description: "Colecionável lacrado em estojo.",
        type: "product",
        minInitialBid: "50.00",
        minBidIncrement: "5.00",
        bidDeadline: new Date(Date.now() - 1000).toISOString(),
      }).success,
    ).toBe(false);
  });

  it("rejeita valores abaixo de R$ 1,00", () => {
    expect(
      itemSchema.safeParse({
        ...base,
        minInitialBid: "0.50",
        minBidIncrement: "5.00",
      }).success,
    ).toBe(false);
  });

  it("aceita ausência de imageUrls", () => {
    expect(itemSchema.safeParse(base).success).toBe(true);
  });

  it("converte imageUrls JSON para lista de urls", () => {
    const result = itemSchema.safeParse({
      ...base,
      imageUrls: JSON.stringify(["https://ex.com/a.jpg", "https://ex.com/b.jpg"]),
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.imageUrls).toEqual(["https://ex.com/a.jpg", "https://ex.com/b.jpg"]);
  });

  it("trata JSON inválido como ausência de imagens", () => {
    const result = itemSchema.safeParse({ ...base, imageUrls: "not-json{{" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.imageUrls).toBeUndefined();
  });

  it("rejeita imageUrls que não é array", () => {
    expect(itemSchema.safeParse({ ...base, imageUrls: '"https://ex.com/a.jpg"' }).success).toBe(false);
  });

  it("rejeita url inválida em imageUrls", () => {
    expect(itemSchema.safeParse({ ...base, imageUrls: JSON.stringify(["not-a-url"]) }).success).toBe(false);
  });
});

describe("becomeSellerSchema", () => {
  it("normaliza slug", () => {
    const result = becomeSellerSchema.safeParse({ slug: "  Loja do Nerd ", role: "seller" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slug).toBe("loja-do-nerd");
  });

  it("rejeita slug inválido", () => {
    expect(becomeSellerSchema.safeParse({ slug: "!!", role: "seller" }).success).toBe(false);
  });

  it("rejeita papel inválido", () => {
    expect(becomeSellerSchema.safeParse({ slug: "nerd", role: "admin" }).success).toBe(false);
  });
});

describe("placeBidSchema", () => {
  it("aceita centavos inteiros a partir de R$ 1,00", () => {
    expect(placeBidSchema.safeParse({ itemId: "0b61e95c-2be1-4d38-8f74-3c5a3a1c8f3a", amount: 5000 }).success).toBe(true);
    expect(placeBidSchema.safeParse({ itemId: "0b61e95c-2be1-4d38-8f74-3c5a3a1c8f3a", amount: 100 }).success).toBe(true);
  });

  it("rejeita valores fracionários em centavos", () => {
    expect(
      placeBidSchema.safeParse({ itemId: "0b61e95c-2be1-4d38-8f74-3c5a3a1c8f3a", amount: 5000.5 }).success,
    ).toBe(false);
  });

  it("rejeita abaixo de R$ 1,00", () => {
    expect(placeBidSchema.safeParse({ itemId: "0b61e95c-2be1-4d38-8f74-3c5a3a1c8f3a", amount: 99 }).success).toBe(false);
  });
});

describe("paridade do lance entre o bidFormSchema (reais) e o placeBidSchema (centavos)", () => {
  const ITEM_ID = "0b61e95c-2be1-4d38-8f74-3c5a3a1c8f3a";

  // ponytail: `minBid` e sempre em CENTAVOS, igual ao `amount` do servidor. Os
  // valores sao literais de proposito: se o `MIN_BID_CENTAVOS` do servidor subir,
  // a linha de 100 (o piso que o `itemSchema` ainda permite) quebra aqui em vez
  // de deixar o cliente aceitar um lance que a action vai rejeitar.
  const MIN_BIDS = [100, 5000, 123456];

  it.each(MIN_BIDS)("minBid %i: o lance correspondente passa nos dois schemas (reais no form, centavos na action)", (minBid) => {
    const form = bidFormSchema(minBid).safeParse({ itemId: ITEM_ID, amountReais: minBid / 100 });
    const action = placeBidSchema.safeParse({ itemId: ITEM_ID, amount: Math.round(minBid) });
    expect({ minBid, form: form.success, action: action.success }).toEqual({ minBid, form: true, action: true });
  });

  it("rejeita no cliente o lance que o servidor rejeita: abaixo do piso canonico", () => {
    const abaixo = 99;
    expect(bidFormSchema(100).safeParse({ itemId: ITEM_ID, amountReais: abaixo / 100 }).success).toBe(false);
    expect(placeBidSchema.safeParse({ itemId: ITEM_ID, amount: abaixo }).success).toBe(false);
  });

  // ponytail: um `minBid` de 50 nao existe (o `itemSchema` ja exige R$ 1,00),
  // mas e o caso que prova o `Math.max`: o cliente tem de acusar o piso do
  // SERVIDOR e nao o do item, senao aceita R$ 0,50 e a action rejeita.
  it("usa o piso canonico do servidor quando o minBid do item esta abaixo dele", () => {
    expect(bidFormSchema(50).safeParse({ itemId: ITEM_ID, amountReais: 1 }).success).toBe(true);
    const abaixo = bidFormSchema(50).safeParse({ itemId: ITEM_ID, amountReais: 0.5 });
    expect(abaixo.success).toBe(false);
    if (!abaixo.success) expect(abaixo.error.issues[0]?.message).toBe("Lance mínimo R$ 1,00");
  });

  // ponytail: o `amountReais` em mais de 2 casas e o `step="0.01"` do input no
  // navegador; o refine do schema e o que garante os centavos inteiros sem
  // depender do navegador.
  it("rejeita no cliente o lance com mais de 2 casas decimais", () => {
    expect(bidFormSchema(100).safeParse({ itemId: ITEM_ID, amountReais: 10.123 }).success).toBe(false);
  });
});

// ponytail: o teto de dinheiro nao e um detalhe de robustez, e a fronteira que
// impede o `err.message` do Postgres de chegar ao usuario. Toda coluna de
// dinheiro e `integer` (int4) e o int4 para em 2_147_483_647; sem o `.max`, um
// `amount: 5000000000` passava pelo schema (que so tinha piso), passava pela
// revalidacao dentro da transacao, e morria no INSERT com `22003 integer out
// of range` — erro que a action devolvia cru, levando o SQL do insert e os
// parametros para a tela. Estes testes existem para travar o `.max` nos DOIS
// lados: o payload do servidor (`placeBidSchema`, em centavos) e o campo do
// form (`bidFormSchema`, em reais). Um teto so no cliente deixaria o buraco
// aberto por POST direto.
describe("teto de dinheiro (limite do int4)", () => {
  const ITEM_ID = "3f6c1f6e-1d5a-4f1e-9b6a-2f0b1c3d4e5f";

  it("rejeita no servidor um lance acima do teto do int4, em centavos", () => {
    // 2.000.000.001 centavos — o menor valor que estoura o teto
    const estoura = placeBidSchema.safeParse({ itemId: ITEM_ID, amount: 2_000_000_001 });
    expect(estoura.success).toBe(false);
    // e o limite exato ainda passa, para o `.max` nao estar curto demais
    expect(placeBidSchema.safeParse({ itemId: ITEM_ID, amount: 2_000_000_000 }).success).toBe(true);
  });

  it("rejeita no cliente o mesmo lance, em reais", () => {
    const estoura = bidFormSchema(100).safeParse({ itemId: ITEM_ID, amountReais: 20_000_000.01 });
    expect(estoura.success).toBe(false);
    expect(bidFormSchema(100).safeParse({ itemId: ITEM_ID, amountReais: 20_000_000 }).success).toBe(true);
  });

  it("rejeita no itemSchema valores de dinheiro acima do teto", () => {
    const base = {
      title: "Action Figure rara",
      description: "Colecionável lacrado em estojo.",
      type: "product",
      minInitialBid: "50.00",
      minBidIncrement: "5.00",
      bidDeadline: new Date(Date.now() + 86_400_000).toISOString(),
    };
    expect(itemSchema.safeParse({ ...base, minInitialBid: "20000000.01" }).success).toBe(false);
    expect(itemSchema.safeParse({ ...base, minBidIncrement: "20000000.01" }).success).toBe(false);
    expect(itemSchema.safeParse({ ...base, minInitialBid: "20000000.00" }).success).toBe(true);
  });
});
