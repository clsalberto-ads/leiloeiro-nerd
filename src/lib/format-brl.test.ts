import { describe, expect, it } from "vitest";
import { formatBRL } from "./format-brl";

describe("formatBRL", () => {
  it("formata centavos sem milhar", () => {
    expect(formatBRL(50)).toBe("0,50");
    expect(formatBRL(5000)).toBe("50,00");
  });

  it("usa separador de milhar pt-BR", () => {
    expect(formatBRL(123456)).toBe("1.234,56");
    expect(formatBRL(123456789)).toBe("1.234.567,89");
  });
});