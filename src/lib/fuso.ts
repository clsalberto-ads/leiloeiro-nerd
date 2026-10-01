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
// (`colunas.tsx`) e no anuncio do `bid-countdown`; `bids.createdAt` na data do
// lance (`bid-history.tsx`) e no agrupamento por dia dos graficos
// (`drizzle-analise-repository.ts`, via `date_trunc`). Se um par divergir, o
// grafico de "lances por dia" conta dias diferentes dos que a lista mostra. Uma
// constante e um comentario; um segundo literal nao se justifica.
//
// O upgrade path, se um dia o produto atender gente fora do Brasil: um
// `APP_TIMEZONE` no `.env.example` lido aqui, com este valor como default.
export const FUSO = "America/Sao_Paulo";

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
// A correcao e simetrica de proposito: `paraInputDeData` (instante -> parede do
// produto) e `deInputDeData` (parede do produto -> instante) usam os DOIS lados o
// `FUSO`, entao o round-trip volta exatamente ao valor de origem, onde quer que a
// maquina ou o navegador estejam. Uma string que ja vem com `Z` ou `+hh:mm` nao e
// ambigua e continua indo direto pro `Date` — assim um ISO completo (o que os
// testes e qualquer cliente de API mandam) nao muda de significado.
//
// A segunda passada em `deInputDeData` existe para o salto de horario: o
// deslocamento e lido no instante ja corrigido, e nao no palpite. O Brasil nao usa
// horario de verao desde 2019, mas e a unica linha que faz o "upgrade path" de um
// `APP_TIMEZONE` para uma regiao com DST continuar sendo verdade.
function partesEmFuso(instante: number) {
  const formatador = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(formatador.formatToParts(new Date(instante)).map((p) => [p.type, p.value]));
}

/** "YYYY-MM-DD" da hora de parede do produto (o dia que o usuario do app le como "o dia de hoje"). */
export function diaLocalDe(d: Date): string {
  const p = partesEmFuso(d.getTime());
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Meia-noite do fuso do produto, `diasAtras` dias de CALENDARIO antes de `base`.
 *
 * ponytail: isto substitui um `setUTCHours(0,0,0,0)` + `setUTCDate(-n)`, que
 * produzia a meia-noite do fuso do SERVIDOR. Numa janela de 30 dias a base em UTC
 * comeca as 21:00 de BRT: o grafico perdia as 3 primeiras horas do primeiro dia
 * (lance de 00h30 nao entrava) e, entre 18h e 21h BRT, rotulava o ultimo ponto
 * com a data de AMANHA. A aritmetica de calendario acontece no texto "YYYY-MM-DD"
 * do fuso do produto e so entao volta para instante — por isso ela nao sofre com
 * mes de 30 dias nem com mudanca de horario.
 */
export function inicioDoDiaLocal(diasAtras = 0, base = new Date()): Date {
  const d = new Date(`${diaLocalDe(base)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - diasAtras);
  return deInputDeData(`${d.toISOString().slice(0, 10)}T00:00`);
}

/** Instante -> "YYYY-MM-DDTHH:mm" na hora de parede do produto (o que o `datetime-local` aceita). */
export function paraInputDeData(d: Date): string {
  const p = partesEmFuso(d.getTime());
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "YYYY-MM-DDTHH:mm" na hora de parede do produto -> instante. Aceita tambem ISO com fuso explicito. */
export function deInputDeData(valor: string): Date {
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(valor)) return new Date(valor);
  const achado = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(valor);
  if (!achado) return new Date(Number.NaN);
  const ano = +achado[1];
  const mes = +achado[2] - 1;
  const dia = +achado[3];
  const hora = +achado[4];
  const minuto = +achado[5];
  // deslocamento do fuso do produto no instante dado, em ms (Sao Paulo = -3 h)
  const deslocamento = (t: number) => {
    const p = partesEmFuso(t);
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(t / 60_000) * 60_000;
  };
  const palpite = Date.UTC(ano, mes, dia, hora, minuto);
  const primeira = palpite - deslocamento(palpite);
  return new Date(palpite - deslocamento(primeira));
}
