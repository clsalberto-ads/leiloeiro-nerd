import { describe, expect, it } from "vitest";
import { becomeSellerSchema, imageUploadSchema, itemSchema, placeBidSchema } from "./validators";

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
