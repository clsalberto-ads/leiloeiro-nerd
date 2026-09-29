/**
 * Mensagem de erro segura para devolver de uma server action.
 *
 * Os use cases lancam `Error` com texto em portugues que o usuario pode
 * corrigir ("Leilão encerrado", "Este slug ja esta em uso"), e isso DEVE chegar
 * ate ele. O que nao pode chegar e o `err.message` de uma falha de driver: o
 * `pg` transforma qualquer erro de banco na consulta que o gerou, entao o
 * usuario veria `Failed query: insert into "bids" (...)` com os parametros, ou
 * `connect ECONNREFUSED 127.0.0.1:5432`, ou `permission denied for schema
 * user` — que entrega a topologia do banco e nao e corrigivel por ele.
 *
 * A distincao nao precisa de classe de erro nova: o driver sempre anexa um
 * `code` (SQLSTATE do Postgres, ou o codigo de socket do Node). Um `Error` sem
 * `code` so pode ter vindo do nosso codigo.
 *
 * ponytail: `fallback` e obrigatorio e nao tem default — cada action sabe qual
 * e a sua mensagem ("Nao foi possivel criar o item", "Erro ao registrar lance"),
 * e um default unico aqui seria lido como "esta action esqueceu de tratar o
 * erro". Passar e o que mantem a lista honesta.
 */
export function mensagemDeErro(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  if ("code" in err) return fallback;
  return err.message || fallback;
}
