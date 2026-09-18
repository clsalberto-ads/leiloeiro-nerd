import { describe, expect, it } from "vitest";
import { becomeSellerSchema, imageUploadSchema, itemSchema } from "./validators";

const img = (size: number) => new File([new ArrayBuffer(size)], "a.jpg", { type: "image/jpeg" });

describe("imageUploadSchema", () => {
  it("aceita até 10 imagens de até 5MB", () => {
    expect(imageUploadSchema.safeParse({ images: Array.from({ length: 10 }, () => img(1024)) }).success).toBe(true);
  });

  it("rejeita mais de 10 imagens", () => {
    expect(imageUploadSchema.safeParse({ images: Array.from({ length: 11 }, () => img(1024)) }).success).toBe(false);
  });

  it("rejeita imagem maior que 5MB", () => {
    expect(imageUploadSchema.safeParse({ images: [img(5 * 1024 * 1024 + 1)] }).success).toBe(false);
  });

  it("rejeita arquivo que não é imagem", () => {
    const txt = new File(["x"], "a.txt", { type: "text/plain" });
    expect(imageUploadSchema.safeParse({ images: [txt] }).success).toBe(false);
  });
});

describe("itemSchema", () => {
  it("aceita dados válidos e converte reais para centavos", () => {
    const result = itemSchema.safeParse({
      title: "Action Figure rara",
      description: "Colecionável lacrado em estojo.",
      type: "product",
      minInitialBid: "50.00",
      minBidIncrement: "5.00",
      bidDeadline: new Date(Date.now() + 86400000).toISOString(),
    });
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
        title: "Action Figure rara",
        description: "Colecionável lacrado em estojo.",
        type: "product",
        minInitialBid: "0.50",
        minBidIncrement: "5.00",
        bidDeadline: new Date(Date.now() + 86400000).toISOString(),
      }).success,
    ).toBe(false);
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
