import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptToken, encryptToken } from "./token-cipher";

// ponytail: a chave de teste é fixa (32 bytes hex) porque o teste precisa ser
// reproduzível; os CASOS são o que importa — roundtrip, IV por linha,
// adulteração e legado.
const TEST_KEY = "a".repeat(64);
const ORIGINAL_KEY = process.env.PAGBANK_TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.PAGBANK_TOKEN_ENCRYPTION_KEY = TEST_KEY;
});

afterEach(() => {
  process.env.PAGBANK_TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
  vi.restoreAllMocks();
});

describe("token-cipher", () => {
  it("roundtrip: o que foi cifrado volta exatamente igual", () => {
    const token = "APP_USR-123456-qualquer-segredo-do-vendedor";
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("o IV é por linha: o MESMO token cifrado duas vezes não produz o mesmo texto", () => {
    const token = "APP_USR-mesmo";
    const a = encryptToken(token);
    const b = encryptToken(token);
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(decryptToken(b));
  });

  it("o texto cifrado não contém o segredo em claro", () => {
    const secret = "segredo-NUNCA-no-texto";
    const cipher = encryptToken(secret);
    expect(cipher).not.toContain(secret);
  });

  it("formato versionado: linha adulterada quebra (tag de autenticidade)", () => {
    const cipher = encryptToken("token-real");
    const partes = cipher.split(":");
    partes[3] = Buffer.from("outra-coisa").toString("base64"); // payload trocado
    expect(() => decryptToken(partes.join(":"))).toThrow("decifrar");
  });

  it("linha legada em texto puro é erro explícito com o remédio (reconectar)", () => {
    expect(() => decryptToken("APP_USR-token-antigo-sem-cifra")).toThrow("reconecte");
  });

  it("chave ausente ou de tamanho errado é erro na hora de usar, com a instrução", () => {
    delete process.env.PAGBANK_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken("x")).toThrow("openssl rand -hex 32");
    process.env.PAGBANK_TOKEN_ENCRYPTION_KEY = "curta";
    expect(() => encryptToken("x")).toThrow("32 bytes");
  });
});

afterAll(() => {
  process.env.PAGBANK_TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
});
