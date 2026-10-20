import { describe, expect, it } from "vitest";
import { calculateFeeCents, PLATFORM_FEE_PERCENT, splitPayment } from "./fee";

describe("taxa de marketplace (5%)", () => {
  it("retém exatamente 5% de valores redondos", () => {
    expect(calculateFeeCents(100_000)).toBe(5_000); // R$ 1.000,00 → R$ 50,00
    expect(splitPayment(100_000)).toEqual({
      platformFeeCents: 5_000,
      sellerNetCents: 95_000,
    });
  });

  it("arredonda no centavo e o par sempre fecha (net + fee = total)", () => {
    // R$ 9,99: 999 * 0,05 = 49,95 → 50
    expect(calculateFeeCents(999)).toBe(50);
    const split = splitPayment(999);
    expect(split.sellerNetCents + split.platformFeeCents).toBe(999);
  });

  it("itens baratos: taxa pode ser zero, mas nunca negativa nem maior que o valor", () => {
    // R$ 0,01 → 0,05 centavos arredonda para 0
    const split = splitPayment(1);
    expect(split.platformFeeCents).toBe(0);
    expect(split.sellerNetCents).toBe(1);

    // R$ 0,09 → 0,45 arredonda para 0; R$ 0,10 → 0,5 arredonda para 1
    expect(calculateFeeCents(9)).toBe(0);
    expect(calculateFeeCents(10)).toBe(1);
    expect(calculateFeeCents(10)).toBeLessThanOrEqual(10);
  });

  it("rejeita valor não inteiro, zero ou negativo (o mesmo contrato do dinheiro)", () => {
    expect(() => splitPayment(0)).toThrow();
    expect(() => splitPayment(-100)).toThrow();
    expect(() => splitPayment(99.5)).toThrow();
    expect(() => splitPayment(Number.NaN)).toThrow();
  });

  it("a constante é 5% — o número que os KPIs e o ledger presumem", () => {
    expect(PLATFORM_FEE_PERCENT).toBe(0.05);
  });
});
