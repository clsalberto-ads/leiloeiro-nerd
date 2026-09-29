import { describe, expect, it } from "vitest";
import { DIAS_POR_PERIODO, PERIODO_PADRAO, hrefDoPeriodo, interpretarPeriodo, nomeDoPeriodo } from "./periodo";

// ponytail: este arquivo e o CONTRATO DA URL do dashboard, e ele existe pelo
// mesmo motivo do `estado-da-tabla.ts` do lado dele: a pagina (servidor) e o
// `<PeriodoSelect>` (cliente) precisam ler e escrever a MESMA escolha pelas
// MESMAS funcoes, e nenhum parametro pode virar duas respostas diferentes
// dependendo de quem leu.
//
// `?periodo` nao interage com nenhum outro parametro desta tela (o dashboard
// nao tem busca, nem pagina, nem ordenacao), entao o href e a string simples
// com um parametro — nao ha a ordem fixa de cinco campos daquele arquivo.
const PERIGOSOS = ["", " ", "30", "30days", "7D", "90d ", "-7d", "0d", "1d", "365d", "javascript", "7d&x=1"];

describe("interpretarPeriodo", () => {
  it("le 7d, 30d e 90d, que sao as janelas oferecidas", () => {
    for (const [escrito, dias] of [["7d", 7], ["30d", 30], ["90d", 90]] as const) {
      expect(interpretarPeriodo(escrito).dias).toBe(dias);
    }
  });

  it("cai no padrao quando o parametro nao veio", () => {
    expect(interpretarPeriodo(null).dias).toBe(DIAS_POR_PERIODO[PERIODO_PADRAO]);
    expect(interpretarPeriodo(null).chave).toBe("30d");
  });

  // ponytail: valor invalido NAO vira 404 e NAO e ignorado em silencio — cai no
  // padrao, a mesma decisao do `interpretarParametros` do `estado-da-tabela.ts`
  // (veja o `ponytail:` la sobre `?orderBy;drop`). Um `?periodo` malformado e
  // erro de digitacao ou link de uma versao antiga da tela; transformar isso em
  // "esta pagina nao existe" seria a resposta errada. E o `dias` do padrao
  // precisa continuar valendo para o `useCase` nao receber um `NaN` de um `NaN`
  // que veio do `searchParams`.
  it.each(PERIGOSOS)("cai no padrao com %o", (bruto) => {
    const lido = interpretarPeriodo(bruto);
    expect(lido.dias).toBe(DIAS_POR_PERIODO[PERIODO_PADRAO]);
    expect(lido.chave).toBe(PERIODO_PADRAO);
  });

  it("nunca devolve um numero que nao seja um dos tres offerecidos", () => {
    for (const bruto of [...PERIGOSOS, "7d", "30d", "90d"]) {
      expect(Object.values(DIAS_POR_PERIODO)).toContain(interpretarPeriodo(bruto).dias);
    }
  });
});

describe("hrefDoPeriodo", () => {
  it("escreve a chave, e nao os dias", () => {
    expect(hrefDoPeriodo("7d")).toBe("/dashboard?periodo=7d");
    expect(hrefDoPeriodo("90d")).toBe("/dashboard?periodo=90d");
  });

  // ponytail: escrever `?periodo=30` (os dias) seria uma URL que o LEITOR
  // rejeitaria e cairia no padrao — a mesma tela com dois enderecos, e o botao
  // "voltar" do navegador sem saber qual desfazer. E o mesmo defeito que o
  // `estado-da-tabela.ts` resolve com a ordem fixa dos parametros.
  it("escreve o padrao como chave, nunca como numero", () => {
    expect(hrefDoPeriodo(PERIODO_PADRAO)).toBe("/dashboard?periodo=30d");
    expect(hrefDoPeriodo(PERIODO_PADRAO)).toContain("periodo=30d");
  });

  it("cada chave produz um href diferente — o link e distinguivel", () => {
    const hrefs = (["7d", "30d", "90d"] as const).map(hrefDoPeriodo);
    expect(new Set(hrefs).size).toBe(3);
  });
});

describe("nomeDoPeriodo", () => {
  it("da um rotulo em portugues para cada janela", () => {
    expect(nomeDoPeriodo("7d")).toBe("7 dias");
    expect(nomeDoPeriodo("30d")).toBe("30 dias");
    expect(nomeDoPeriodo("90d")).toBe("90 dias");
  });
});
