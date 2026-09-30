"use client";

import { useEffect, useState } from "react";
import { FUSO } from "@/lib/fuso";

function format(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${d} d ${h} h ${m} min ${s} s`;
}

// ponytail: o prazo que o leitor de tela ouve e formatado com `FUSO`, e nao com
// `getUTC*`. As duas formas mostram o mesmo instante com textos diferentes, e o
// produto tem fuso fixo (ver `@/lib/fuso`) — o vendedor digita "30/09 23:59" no
// formulario e a tela precisa devolver "30/09 23:59". A versao com `getUTC*`
// devolvia "1/10 2:59": um dia e tres horas de erro, invisivel porque o
// countdown numerico (aritmetica de `Date`) contava certo. O upgrade path, se o
// produto atender gente fora do Brasil, e um `APP_TIMEZONE` no `.env` lido em
// `@/lib/fuso` — este arquivo continua lendo a constante e nao muda.
function formatAbsolute(d: Date): string {
  return d.toLocaleString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BidCountdown({ deadline }: { deadline: Date }) {
  const [ms, setMs] = useState<number>(() => Math.max(0, deadline.getTime() - Date.now()));

  useEffect(() => {
    const update = () => setMs(Math.max(0, deadline.getTime() - Date.now()));
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (ms <= 0) return <span className="font-medium text-muted-foreground" role="timer">Encerrado</span>;

  const formatted = format(ms);
  const formattedDate = formatAbsolute(deadline);

  // ponytail: SEM `aria-live` aqui, e o `role="timer"` que faz o trabalho. O
  // `timer` implica `aria-live="off"` na spec de ARIA; o `aria-live="polite"`
  // que estava nesta span sobrescrevia essa implicacao e fazia o leitor de tela
  // anunciar "0 d 0 h 2 min 3 s" — uma vez por SEGUNDO, durante a duracao
  // inteira do leilao. Quem usa leitor de tela nao consegue ler a pagina por
  // cima disso, que e o oposto do que o atributo pretendia fazer.
  //
  // O que o usuario de leitor de tela recebe agora e o prazo ABSOLUTO, no
  // `sr-only` abaixo: ele navega ate la uma vez e sabe ate quando da. O
  // upgrade path, se um dia o contagem regressiva precisar ser anunciada, e uma
  // regiao `aria-live="polite"` SEPARADA que so muda em degraus (1 min, 10 min,
  // 1 h) em vez de a cada tick — nunca este no texto que muda 1x/segundo.
  return (
    <span role="timer" className="motion-reduce:animate-none">
      {formatted}
      <span className="sr-only">{`Prazo: ${formattedDate}`}</span>
    </span>
  );
}