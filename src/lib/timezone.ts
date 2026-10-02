// ponytail: o fuso do PRODUTO, nao o do processo. Um servidor em UTC (o padrao de
// nuvem) e um navegador em Sao Paulo veriam o mesmo instante com textos
// diferentes, e o React acusa divergencia de hidratacao no texto do `<time>` e
// descarta a arvore do servidor. O efeito no produto e pior que o aviso: o
// `item-form` le o `datetime-local` como hora local, entao o vendedor digitando
// "30/09 22:00" submete `2026-10-01T01:00Z` e a lista mostraria "01/10" num
// servidor em UTC — um dia depois do prazo que ele acabou de cadastrar.
//
// A alternativa seria o servidor rodar em Sao Paulo (fuso do processo = fuso do
// produto). Fixar aqui deixa o fuso do produto explicito e igual em qualquer
// maquina, sem depender de onde o deploy caiu.
//
// Este arquivo existe porque o mesmo instante e formatado em mais de um lugar, e
// os pares precisam concordar no dia: `bidDeadline` na celula de prazo
// (`columns.tsx`) e no anuncio do `bid-countdown`; `bids.createdAt` na data do
// lance (`bid-history.tsx`) e no agrupamento por dia dos graficos
// (`drizzle-analytics-repository.ts`, via `date_trunc`). Se um par divergir, o
// grafico de "lances por dia" conta dias diferentes dos que a lista mostra. Uma
// constante e um comentario; um segundo literal nao se justifica.
//
// O upgrade path, se um dia o produto atender gente fora do Brasil: um
// `APP_TIMEZONE` no `.env.example` lido aqui, com este valor como default.
export const APP_TIMEZONE = "America/Sao_Paulo";

// ponytail: estes dois conversores sao o OUTRO LADO do `FUSO`, e existem porque o
// `<input type="datetime-local">` manda uma "hora de parede" sem fuso nenhum
// ("2026-09-30T23:59"). O par `new Date(essaString)` / `toISOString()` do
// `item-form` e do `z.coerce.date()` interpreta essa string no fuso do PROCESSO, e
// num servidor em UTC (o padrao de nuvem) isso dava, medido aqui: o vendedor
// cadastrando 30/09 23:59 via 01/10 02:59 no HTML, o navegador re-renderizando
// 30/09 23:59 na hidratacao (divergencia que o React acusa), e — o que dói de
// verdade — salvar QUALQUER campo do item arrastando o prazo junto: o servidor
// lia "30/09 23:59" como 23:59 UTC e gravava 3 h antes do prazo escolhido. O
// leilao encerrava 3 h mais cedo, sem ninguem ter tocado no campo de data.
//
// A correção é simétrica de propósito: `toInputDateString` (instante -> hora de
// relógio do produto) e `fromInputDateString` (hora de relógio do produto ->
// instante) AMBOS usam `APP_TIMEZONE`, então o ida-e-volta devolve exatamente o
// valor original, independentemente de onde a máquina ou o navegador esté. Uma
// string que já tem `Z` ou `+hh:mm` é inequívoca e vai direto para `new Date` — então
// uma ISO completa (o que os testes e qualquer cliente de API enviam) não muda de
// significado.
//
// A segunda passada em `fromInputDateString` existe por causa das transições de
// horário de verão: o offset é lido do instante já corrigido, não da estimativa.
// O Brasil não usa horário de verão desde 2019, mas esta é a única linha que faz
// o "caminho de upgrade" de um `APP_TIMEZONE` para uma região com horário de verão
// continuar funcionando.
function partsInTimezone(instant: number) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(formatter.formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
}

/** "YYYY-MM-DD" da hora de relógio do produto (o dia que o usuário do app lê como "hoje"). */
export function localDateOf(d: Date): string {
  const p = partsInTimezone(d.getTime());
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Meia-noite no fuso do produto, `daysAgo` dias-calendário antes de `base`.
 *
 * ponytail: isto substitui um `setUTCHours(0,0,0,0)` + `setUTCDate(-n)`, que
 * produzia meia-noite no fuso do SERVIDOR. Em uma janela de 30 dias com base em
 * UTC começando às 21:00 BRT: o gráfico perdia as 3 primeiras horas do dia 1 (um
 * lance às 00:30 não contava) e, entre 18h e 21h BRT, rotulava o último ponto com
 * a data de AMANHÃ. A aritmética de calendário acontece no texto "YYYY-MM-DD" do
 * fuso do produto e só então converte de volta para instante — assim não sofre com
 * meses de 30 dias nem com mudanças de horário de verão.
 */
export function startOfLocalDay(daysAgo = 0, base = new Date()): Date {
  const d = new Date(`${localDateOf(base)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return fromInputDateString(`${d.toISOString().slice(0, 10)}T00:00`);
}

/** Instante -> "YYYY-MM-DDTHH:mm" na hora de relógio do produto (o que `datetime-local` aceita). */
export function toInputDateString(d: Date): string {
  const p = partsInTimezone(d.getTime());
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "YYYY-MM-DDTHH:mm" na hora de relógio do produto -> instante. Também aceita ISO explícita com zona. */
export function fromInputDateString(value: string): Date {
  // Já tem zona explícita (Z ou +hh:mm) → inequívoco, vai direto para Date
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(value)) return new Date(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
  if (!match) return new Date(Number.NaN);
  const year = +match[1];
  const month = +match[2] - 1;
  const day = +match[3];
  const hour = +match[4];
  const minute = +match[5];
  // Offset do fuso do produto no instante dado, em ms (São Paulo = -3 h)
  const offset = (t: number) => {
    const p = partsInTimezone(t);
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(t / 60_000) * 60_000;
  };
  const guess = Date.UTC(year, month, day, hour, minute);
  const first = guess - offset(guess);
  return new Date(guess - offset(first));
}
