// ponytail: `bids.id`, `items.id` e `users.id` sao `uuid` no Postgres, e o
// `pg` manda o valor como texto no SQL. Um id fora do formato estourava no
// Postgres — que, numa pagina, NAO e um 404:
// nao ha try/catch no meio, entao o erro sobe e vira 500.
//
// A distincao importa: 500 diz "a aplicacao quebrou" e manda o visitante
// procurar um bug; 404 diz "esse endereco nao existe", que e a verdade. O
// `item-actions.ts` ja tinha este regex para as server actions — ele ficou la
// como constante de arquivo, e as paginas, que leem o id do PATH, ficaram sem
// nada. Um unico lugar evita a proxima pagina nascer com a mesma falha.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}
