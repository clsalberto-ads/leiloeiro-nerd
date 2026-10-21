import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// ponytail: a conta PagBank do vendedor é o DINHEIRO dele — o access
// token move dinheiro e o refresh token fabrica novos tokens por ~6 meses.
// Guardados em texto puro, um dump do banco (backup vazado, SQL injection
// em outro app do mesmo host, snapshot de staging) entrega a conta inteira.
// A cifra é AES-256-GCM: iv aleatório por linha (o MESMO token cifrado duas
// vezes produz textos diferentes), tag de autenticidade (adulterar uma linha
// quebra a leitura em vez de devolver outra coisa).
//
// O formato é versionado (`v1:`) DE PROPÓSITO: detectar linha legada em texto
// puro é trivial (não começa com "v1:"), e um dia trocar o algoritmo vira
// "v2:" sem reescrever a leitura das linhas antigas.

const FORMAT_VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;

/**
 * A chave vem do .env (hex de 64 caracteres = 32 bytes). Dedicada ao token MP
 * — NÃO derivada do BETTER_AUTH_SECRET: a chave de sessão e a chave do
 * dinheiro de terceiros devem poder RODAR separadas.
 *
 * Lê em cada chamada (e não no import) para o teste poder definir o env.
 */
function loadKey(): Buffer {
  const raw = process.env.PAGBANK_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "PAGBANK_TOKEN_ENCRYPTION_KEY ausente: gere com `openssl rand -hex 32` e defina no .env antes de conectar contas PagBank",
    );
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `PAGBANK_TOKEN_ENCRYPTION_KEY deve ter 32 bytes em hex (64 caracteres) — recebidos ${key.length}`,
    );
  }
  return key;
}

/** Cifra um token para gravar. Formato: `v1:<iv b64>:<tag b64>:<dados b64>`. */
export function encryptToken(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    FORMAT_VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decifra um token lido do banco. Linha em texto puro (legada, gravada antes
 * da cifra) é ERRO EXPLÍCITO com o remédio no texto: reconectar a conta — a
 * chave de reencryptar linhas antigas daria uma janela em que AMBAS as formas
 * valem, e "aceitar as duas" é a porta que um atacante usaria com um token
 * colado à mão.
 */
export function decryptToken(ciphertext: string): string {
  if (!ciphertext.startsWith(`${FORMAT_VERSION}:`)) {
    throw new Error("Token PagBank legado em texto puro: reconecte a conta nas configurações");
  }
  const [version, ivB64, tagB64, dataB64] = ciphertext.split(":");
  if (version !== FORMAT_VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Token PagBank cifrado em formato desconhecido");
  }
  const key = loadKey();
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    // tag errada = chave trocada OU linha adulterada; os dois pedem a mesma
    // resposta (reconectar), e nenhum detalhe interno sobe.
    throw new Error("Falha ao decifrar token PagBank: verifique a PAGBANK_TOKEN_ENCRYPTION_KEY ou reconecte a conta");
  }
}
