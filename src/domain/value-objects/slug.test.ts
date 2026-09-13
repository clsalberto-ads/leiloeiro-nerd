import { describe, expect, it } from "vitest";
import { createSlug } from "./slug";

describe("createSlug", () => {
  it("normaliza acentos e espaços", () => {
    expect(createSlug("Nerd Colecionáveis")).toBe("nerd-colecionaveis");
  });

  it("substitui não alfanuméricos por hífen único", () => {
    expect(createSlug("Café & Cia -- 25")).toBe("cafe-cia-25");
  });

  it("lança erro quando o resultado é vazio", () => {
    expect(() => createSlug("   !!  ")).toThrow();
  });

  it("lança erro quando excede 60 caracteres", () => {
    expect(() => createSlug("a".repeat(61))).toThrow();
  });
});