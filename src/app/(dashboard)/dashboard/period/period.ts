// ponytail: o CONTRATO DA URL do dashboard. Existe pelo mesmo motivo do
// `dashboard-table-state.ts` do lado dele: a pagina (servidor) e o `<PeriodSelect>`
// (cliente) leem e escrevem a MESMA escolha pelas MESMAS funcoes, e um parametro
// nao pode virar duas respostas diferentes dependendo de quem leu.
//
// Diferente daquele arquivo, `?periodo` nao interage com nenhum outro parametro
// desta tela — o dashboard nao tem busca, nem pagina, nem ordenacao — entao o
// href e a string simples com um parametro, e nao ha ordem fixa de campos.
//
// O parametro REPETIDO (`?periodo=7d&periodo=90d` chega no Next como array) e
// resolvido pelo `firstValue` de `@/lib/first-value`, aplicado na pagina ANTES de
// chegar aqui: `parsePeriod(firstValue(params.periodo))`. O "o primeiro vence" e a
// unica politica coerente com o `URLSearchParams.get` do cliente, e ele mora em um
// modulo so justamente para nao haver duas copias.
//
// Nenhum deste arquivo importa `next/*`, `react` ou qualquer componente: e por
// isso que roda no servidor E no cliente, e que o teste acima nao precisa de
// jsdom.

export const DASHBOARD_PATH = "/dashboard";

/** As tres janelas oferecidas. Uma janela fora desta lista nao existe. */
export const DAYS_PER_PERIOD = { "7d": 7, "30d": 30, "90d": 90 } as const;

export type PeriodKey = keyof typeof DAYS_PER_PERIOD;

export const DEFAULT_PERIOD: PeriodKey = "30d";

export interface Period {
  key: PeriodKey;
  days: number;
}

// ponytail: `Object.hasOwn` e nao `in` nem `includes`. `?periodo=toString`
// passaria num `in DAYS_PER_PERIOD` (todo objeto herda de `Object.prototype`)
// e viraria `undefined` no `dias`, que seguiria para o `useCase` e para o
// `date_trunc` do Postgres. A lista aqui e um `Record` de chaves fixas, entao
// a propria checagem resolve.
const KEYS = new Set<string>(Object.keys(DAYS_PER_PERIOD));

/**
 * Le `?periodo` e devolve a janela.
 *
 * ponytail: valor invalido NAO vira 404 e NAO e ignorado em silencio — cai no
 * padrao, a mesma decisao do `parseDashboardParams` do `dashboard-table-state.ts`
 * (veja o `ponytail:` la sobre `?orderBy=;drop`). Um `?periodo` malformado e erro
 * de digitacao ou link de uma versao antiga da tela; transformar isso em "esta
 * pagina nao existe" seria a resposta errada para uma tela que existe e
 * funciona. Por isso o retorno NUNCA e um `dias` arbitrario: a funcao so pode
 * devolver uma das tres janelas, e o `useCase` sempre recebe um inteiro valido.
 */
export function parsePeriod(bruto: string | null | undefined): Period {
  const key = bruto !== null && bruto !== undefined && KEYS.has(bruto) ? (bruto as PeriodKey) : DEFAULT_PERIOD;
  return { key, days: DAYS_PER_PERIOD[key] };
}

/**
 * Escreve a janela na URL.
 *
 * ponytail: escreve a CHAVE (`30d`), nunca os dias (`?periodo=30`). Um href com
 * os dias seria uma URL que o LEITOR rejeitaria e cairia no padrao — a mesma
 * tela com dois enderecos, e o botao "voltar" do navegador sem saber qual
 * desfazer. E o mesmo defeito que o `dashboard-table-state.ts` resolve com a ordem
 * fixa dos parametros dele.
 */
export function buildPeriodHref(key: PeriodKey): string {
  return `${DASHBOARD_PATH}?periodo=${key}`;
}

const LABELS: Record<PeriodKey, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
};

/** Rotulo curto para o select. "30 dias" e o texto, e nao "30d", que e o URL. */
export function periodLabel(key: PeriodKey): string {
  return LABELS[key];
}
