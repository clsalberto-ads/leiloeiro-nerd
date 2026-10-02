import { describe, expect, it } from "vitest";
import { storefrontQuery } from "./drizzle-user-repository";

// ponytail: este arquivo existe por um bug que NENHUM outro teste pegou, e a
// historia vale mais que o teste: `findVitrineBySlug` usava uma subquery
// correlacionada com `${userTable.id}` dentro de um `sql` cru. O drizzle 0.45
// renderiza a coluna de uma tabela que nao esta no `FROM` da subquery SEM
// qualificar — saiu `i.seller_id = "id"`, e dentro do escopo da subquery esse
// `"id"` resolve para `items.id`. A query virava `items.seller_id = items.id`,
// `text` contra `uuid`, e o Postgres respondia `42883: no operator matches`.
// A vitrine respondia HTTP 500.
//
// Por que nada pegou: os fakes do use case nao passam pelo SQL, a porta era nova
// (portanto nao havia teste de integracao), e `pnpm build` + 634 testes + tsc
// limpoam todos. O unico lugar que executa essa query e a ROTA REAL — e foi ela
// que derrubou.
//
// O que este `it` trava e a CLASSE do defeito, nao a frase: uma coluna de uma
// tabela que nao esta no `FROM` da subquery, escrita sem qualificar, e um
// comparavel que o Postgres nao tem. `sql.raw` passing por cima produziria o
// mesmo SQL quebrado com a suite inteira verde, entao a guarda e sobre o SQL
// gerado, e nao sobre a forma do codigo.
describe("drizzleSellerStorefrontRepository — o SQL que ele gera", () => {
  // ponytail: o teste chama a consulta que o REPOSITORIO chama, e nao uma
  // reconstrucao dela aqui. A primeira versao deste arquivo montava o proprio
  // `db.select()` para conferir o SQL — e isso testava uma COPIA: mudar o
  // repositorio deixava o teste verde, que e a segunda fonte de verdade que este
  // projeto vem desarmando. A consulta foi extraida para uma funcao exportada por
  // esse motivo, e nao por organizacao.
  const query = () => storefrontQuery("x");


  it("qualifica a coluna do usuario dentro da contagem", () => {
    const generatedSql = query().toSQL().sql;
    // o `on` do join tem de dizer de qual tabela e cada lado
    expect(generatedSql).toContain('"items"."seller_id" = "user"."id"');
  });

  it("a contagem e de `items.id` qualificado, e nao de uma coluna solta", () => {
    const generatedSql = query().toSQL().sql;
    // sem o qualificador, um `count("id")` aqui contaria a coluna ambigua e o
    // erro reaparece em outra forma
    expect(generatedSql).toContain('count("items"."id")::int');
  });

  it("e leftJoin, e nao innerJoin: vendedor sem item ativo tem de voltar com 0", () => {
    // ponytail: com `innerJoin` a linha do vendedor SUMIRIA quando nao houvesse
    // item ativo, e `findVitrineBySlug` devolveria `null` — o `notFound()` do
    // shell responderia 404 para um vendedor que EXISTE e nao tem nada leiloado.
    // E o `count` volta 0 (e nao null) porque e `count(items.id)` sobre um
    // `leftJoin`, que conta zero linhas quando nao houve casamento.
    expect(query().toSQL().sql).toContain('left join "items"');
  });

  it("o filtro de `active` fica no ON, e nao no WHERE", () => {
    // no `where` o filtro depois de um `leftJoin` vira `innerJoin` disfarçado e o
    // vendedor sem item ativo some — o mesmo defeito do item anterior, por outra
    // porta. Os parametros sao: $1 = "active" (o ON) e $2 = "x" (o slug).
    const { sql: generatedSql, params } = query().toSQL();
    expect(generatedSql).toContain('and "items"."status" = $1');
    expect(params[0]).toBe("active");
  });
});
