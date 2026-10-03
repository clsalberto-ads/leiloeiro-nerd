// ponytail: dinheiro em CENTAVOS e `integer` no Postgres. O schema valida, mas o
// use case existe "justamente para nao confiar no schema" (ver o comentario em
// `placeBid`), e `createItem`/`placeBid` sao AMBOS `number` — o piso
// `minInitialBid` falhava aberto e deixava `NaN` chegar ao INSERT, estourando
// `22003 numeric_value_out_of_range`. Guard que segura so metade do dominio e pior que
// nenhum: da sensacao de protecao sem dar.
import { MAX_CENTS } from "@/lib/validators";
// `Number.isSafeInteger` cobre as DUAS primeiras (nao-e-NaN, nao-e-Infinito) e
// segura o inteiro, mas o seu teto e 2^53-1 — nao o do `int4`, que estoura em
// 2_147_483_647. O `isSafeInteger` sozinho deixava passar `amount: 5000000000`,
// que morria no `INSERT` com `22003 integer out of range`, o mesmo erro que o
// `MAX_CENTS` do schema ja fecha na fronteira. E o comentario antigo ("inteiro
// dentro do range que o int4 aguenta") afirmava uma propriedade que o
// `isSafeInteger` nao tem: e o mesmo "guard que segura so metade do dominio" que
// o topo deste arquivo reprova. O `MAX_CENTS` e a MESMA constante do schema
// (2_000_000_000 < 2_147_483_647), importada para nao haver dois tetos divergindo.
export function invalidMoney(amount: number): boolean {
  return !Number.isSafeInteger(amount) || amount < 100 || amount > MAX_CENTS;
}

// O schema restringe a 1..30 (`paymentDeadlineDays`) e a coluna nao tem CHECK, entao a
// janela de pagamento precisa ser re-checada aqui como o resto.
export function invalidPaymentDays(days: number | undefined): boolean {
  return days !== undefined && (!Number.isSafeInteger(days) || days < 1 || days > 30);
}
