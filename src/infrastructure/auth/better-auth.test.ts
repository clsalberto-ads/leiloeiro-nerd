import { describe, expect, it } from "vitest";

/**
 * Este teste le o ARQUIVO, nao importa o modulo: `better-auth.ts` constroi a
 * configuracao no import (e `db` exige variavel de ambiente e conexao), entao
 * importar aqui puxaria o Postgres para dentro de um teste sobre duas linhas.
 *
 * O que esta em jogo e estatico por natureza — "existe um guard de ambiente antes
 * do `console.log` do token, e ele falha fechado" — e a leitura do fonte e a
 * prova mais barata e mais fiel disso. Nao ha `eval` nem `new Function` aqui de
 * proposito: reconstruir a funcao a partir do texto com tipos do TypeScript
 * dentro e fragil da maneira mais chata (quebra na proxima assinatura que mudar),
 * e nao provaria nada a mais do que os dois `it` abaixo.
 */
async function callbackExcerpt(): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const txt = await readFile(join(process.cwd(), "src/infrastructure/auth/better-auth.ts"), "utf8");
  const start = txt.indexOf("sendResetPassword");
  if (start < 0) throw new Error("sendResetPassword nao encontrado em better-auth.ts");
  return txt.slice(start, start + 700);
}

describe("link de redefinição de senha não vaza para o log em produção", () => {
  it("existe um guard de ambiente ANTES do console.log do token", async () => {
    // A `url` do `sendResetPassword` é o token de redefinição: quem lê o stdout do
    // processo toma conta da conta de quem pediu a redefinição. O prefixo "[DEV]"
    // não protegia nada — não havia guard. Este `it` falha no instante em que o
    // guard sair ou passar para depois do log.
    const trecho = await callbackExcerpt();
    const guard = trecho.indexOf("NODE_ENV");
    const log = trecho.indexOf("console.log");

    expect(log, "o console.log do token sumiu — reveja este teste").toBeGreaterThan(-1);
    expect(guard, "sem guard de NODE_ENV o token vai para o log de producao").toBeGreaterThan(-1);
    expect(guard, "o guard precisa vir ANTES do console.log, senao nao protege nada").toBeLessThan(log);
  });

  it("produção falha fechado: nenhum link é emitido sem provedor de e-mail", async () => {
    // ponytail: falhar fechado e o unico jeito seguro de nao ter o provedor ainda.
    // O "sem link nenhum e com erro na tela" incomoda menos que "um token de
    // redefinicao inteiro no log de um servidor de producao". O upgrade path e o
    // Resend na Fase 3, que troca o `throw` por um `send`.
    const trecho = await callbackExcerpt();
    expect(trecho).toMatch(/NODE_ENV\s*===\s*"production"/);
    expect(trecho).toMatch(/throw new Error\(/);
    // o `throw` tem que estar no ramo de producao, e nao num `catch` ou depois do log
    const guard = trecho.indexOf("NODE_ENV");
    const lanca = trecho.indexOf("throw new Error");
    const log = trecho.indexOf("console.log");
    expect(guard).toBeLessThan(lanca);
    expect(lanca).toBeLessThan(log);
  });

  it("o guard é sobre produção, e não sobre 'não é dev' (o placeholder roda em teste)", async () => {
    const trecho = await callbackExcerpt();
    // ponytail: trocar por `NODE_ENV === "development"` faz o link deixar de sair
    // em CI, onde nenhum humano esta olhando o stdout — o placeholder vira um beco
    // sem saida. Este `it` trava a forma do guard sem travar o valor.
    expect(trecho).not.toContain('NODE_ENV === "development"');
    expect(trecho).not.toContain("NODE_ENV !== 'production'");
  });
});
