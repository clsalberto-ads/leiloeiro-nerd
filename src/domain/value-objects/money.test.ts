import { describe, expect, it } from "vitest";
import { money, moneyAdd, moneyFromReais, moneyToReais } from "./money";

describe("money", () => {
  it("aceita centavos inteiros", () => {
    expect(money(150).cents).toBe(150);
  });

  it("rejeita valores não inteiros", () => {
    expect(() => money(1.5)).toThrow();
  });

  it("converte reais para centavos sem precisão flutuante", () => {
    expect(moneyFromReais(12.34).cents).toBe(1234);
    expect(moneyFromReais(0.1).cents).toBe(10);
  });

  it("converte centavos para reais", () => {
    expect(moneyToReais(money(12345))).toBe(123.45);
  });

  it("soma em centavos", () => {
    expect(moneyAdd(money(100), money(250)).cents).toBe(350);
  });
});