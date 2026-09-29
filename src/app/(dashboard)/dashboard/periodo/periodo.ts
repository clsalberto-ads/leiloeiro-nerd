// ponytail: o CONTRATO DA URL do dashboard. Existe pelo mesmo motivo do
// `estado-da-tabela.ts` do lado dele: a pagina (servidor) e o `<PeriodoSelect>`
// (cliente) leem e escrevem a MESMA escolha pelas MESMAS funcoes, e um parametro
// nao pode virar duas respostas diferentes dependendo de quem leu.
//
// Diferente daquele arquivo, `?periodo` nao interage com nenhum outro parametro
// desta tela — o dashboard nao tem busca, nem pagina, nem ordenacao — entao o
// href e a string simples com um parametro, e nao ha ordem fixa de campos.
//
// O `primeiroValor` (parametro repetido) e o MESMO de `items/page.tsx`, e foi
// extraido para `@/lib/primeiro-valor` justamente para nao haver duas copias do
// "o primeiro vence".
//
// Nenhum deste arquivo importa `next/*`, `react` ou qualquer componente: e por
// isso que roda no servidor E no cliente, e que o teste acima nao precisa de
// jsdom.

import { primeiroValor } from "@/lib/primeiro-valor";

export const CAMINHO_DO_DASHBOARD = "/dashboard";

/** As tres janelas oferecidas. Uma janela fora desta lista nao existe. */
export const DIAS_POR_PERIODO = { "7d": 7, "30d": 30, "90d": 90 } as const;

export type ChavePeriodo = keyof typeof DIAS_POR_PERIODO;

export const PERIODO_PADRAO: ChavePeriodo = "30d";

export interface Periodo {
  chave: ChavePeriodo;
  dias: number;
}

// ponytail: `Object.hasOwn` e nao `in` nem `includes`. `?periodo=toString`
// passaria num `in DIAS_POR_PERIODO` (todo objeto herda de `Object.prototype`)
// e viraria `undefined` no `dias`, que seguiria para o `useCase` e para o
// `date_trunc` do Postgres. A lista aqui e um `Record` de chaves fixas, entao
// a propria checagem resolve.
const CHAVES = new Set<string>(Object.keys(DIAS_POR_PERIODO));

/**
 * Le `?periodo` e devolve a janela.
 *
 * ponytail: valor invalido NAO vira 404 e NAO e ignorado em silencio — cai no
 * padrao, a mesma decisao do `interpretarParametros` do `estado-da-tabela.ts`
 * (veja o `ponytail:` la sobre `?orderBy;drop`). Um `?periodo` malformado e erro
 * de digitacao ou link de uma versao antiga da tela; transformar isso em "esta
 * pagina nao existe" seria a resposta errada para uma tela que existe e
 * funciona. Por isso o retorno NUNCA e um `dias` arbitrario: a funcao so pode
 * devolver uma das tres janelas, e o `useCase` sempre recebe um inteiro valido.
 */
export function interpretarPeriodo(bruto: string | null | undefined): Periodo {
  const chave = bruto !== null && bruto !== undefined && CHAVES.has(bruto) ? (bruto as ChavePeriodo) : PERIODO_PADRAO;
  return { chave, dias: DIAS_POR_PERIODO[chave] };
}

/**
 * Escreve a janela na URL.
 *
 * ponytail: escreve a CHAVE (`30d`), nunca os dias (`?periodo=30`). Um href com
 * os dias seria uma URL que o LEITOR rejeitaria e cairia no padrao — a mesma
 * tela com dois enderecos, e o botao "voltar" do navegador sem saber qual
 * desfazer. E o mesmo defeito que o `estado-da-tabela.ts` resolve com a ordem
 * fixa dos parametros dele.
 */
export function hrefDoPeriodo(chave: ChavePeriodo): string {
  return `${CAMINHO_DO_DASHBOARD}?periodo=${chave}`;
}

const ROTULOS: Record<ChavePeriodo, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
};

/** Rotulo curto para o select. "30 dias" e o texto, e nao "30d", que e o URL. */
export function nomeDoPeriodo(chave: ChavePeriodo): string {
  return ROTULOS[chave];
}
