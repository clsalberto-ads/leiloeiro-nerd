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
// Este arquivo existe porque o valor aparecia em DOIS lugares que precisam
// concordar: a celula de prazo da tabela (`items-list.tsx`) e o agrupamento por
// dia dos graficos (`drizzle-analise-repository.ts`, via `date_trunc`). Se os
// dois divergirem, o grafico de "lances por dia" contaria dias diferentes dos que
// a lista de itens mostra. Uma constante e um comentario; dois callers nao
// justificam um segundo literal.
//
// O upgrade path, se um dia o produto atender gente fora do Brasil: um
// `APP_TIMEZONE` no `.env.example` lido aqui, com este valor como default.
export const FUSO = "America/Sao_Paulo";
