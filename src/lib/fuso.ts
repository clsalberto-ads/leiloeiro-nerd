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
