/**
 * Mensagem de erro segura para devolver de uma server action.
 *
 * Os casos de uso lançam `Error` com texto em português voltado ao usuário
 * ("Leilão encerrado", "Este slug já está em uso"), e esse texto PRECISA
 * chegar ao usuário. O que NÃO deve chegar é o `err.message` do driver:
 * o `pg` transforma qualquer erro de banco na query que o causou, então o
 * usuário veria `Failed query: insert into "bids" (...)` com os parâmetros,
 * ou `connect ECONNREFUSED 127.0.0.1:5432`, ou `permission denied for schema
 * user` — o que vaza a topologia do banco e não ajuda ninguém a agir.
 *
 * A distinção não exige uma classe de erro nova: o driver sempre anexa um
 * `code` (SQLSTATE do Postgres, ou código de socket do Node). Um `Error` sem
 * `code` só pode ter vindo do nosso próprio código.
 *
 * ponytail: `fallback` é obrigatório e não tem valor padrão — cada action
 * conhece a sua própria mensagem ("Não foi possível criar o item", "Erro ao
 * dar o lance"), e um único padrão aqui leria como "esta action esqueceu de
 * tratar o erro". Exigir o argumento mantém os pontos de chamada honestos.
 */
export function toActionError(err: unknown, fallback: string): string {
  // Não é instância de Error → devolve o fallback (lançamento desconhecido)
  if (!(err instanceof Error)) return fallback;
  // Erros de driver sempre têm a propriedade `code` → esconde o interno, devolve o fallback
  if ("code" in err) return fallback;
  // Erros do nosso domínio não têm `code` → seguro exibir a mensagem
  return err.message || fallback;
}
