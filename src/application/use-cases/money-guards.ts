// ponytail: dinheiro em CENTAVOS e `integer` no Postgres. O schema valida, mas o
// use case existe "justamente para nao confiar no schema" (ver o comentario em
// `placeBid`), e `createItem`/`placeBid` sao AMBOS `number` — o piso
// `minInitialBid` falhava aberto e deixava `NaN` chegar ao INSERT, estourando
// `22003 numeric_value_out_of_range`. Guard que segura so metade do dominio e pior que
// nenhum: da sensacao de protecao sem dar.
//
// `Number.isSafeInteger` e o teste certo porque diz as tres coisas de uma vez:
// nao-e-NaN, nao-e-Infinito, e inteiro dentro do range que o `int4` aguenta.
// Um `typeof x === "number"` sozinho nao diz nenhuma delas.
export function invalidMoney(amount: number): boolean {
  return !Number.isSafeInteger(amount) || amount < 100;
}

// O schema restringe a 1..30 (`paymentDeadlineDays`) e a coluna nao tem CHECK, entao a
// janela de pagamento precisa ser re-checada aqui como o resto.
export function invalidPaymentDays(days: number | undefined): boolean {
  return days !== undefined && (!Number.isSafeInteger(days) || days < 1 || days > 30);
}
