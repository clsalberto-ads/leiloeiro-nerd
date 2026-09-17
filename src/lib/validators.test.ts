import { describe, expect, it } from "vitest";
import { becomeSellerSchema, itemSchema } from "./validators";

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
