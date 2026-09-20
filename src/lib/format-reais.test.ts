import { describe, expect, it } from "vitest";
import { formatReais } from "./format-reais";

describe("formatReais", () => {
  it("formata centavos sem milhar", () => {
    expect(formatReais(50)).toBe("0,50");
    expect(formatReais(5000)).toBe("50,00");
  });

  it("usa separador de milhar pt-BR", () => {
    expect(formatReais(123456)).toBe("1.234,56");
    expect(formatReais(123456789)).toBe("1.234.567,89");
  });
});