import type { AnaliseRepository, ResumoDoComprador, ResumoDoVendedor, SeriesDoVendedor } from "@/domain/repositories/analise-repository";

export type PapelDoUsuario = "seller" | "bidder" | "both";

export interface VisaoDoVendedor {
  papel: "vendedor";
  resumo: ResumoDoVendedor;
  series: SeriesDoVendedor;
}

export interface VisaoDoComprador {
  papel: "comprador";
  resumo: ResumoDoComprador;
}

export type VisaoDoDashboard = VisaoDoVendedor | VisaoDoComprador;

// ponytail: o `?periodo` NAO entra aqui. Ele e lido pela pagina (que tem os
// `searchParams`) e chega como `dias` ja validado pelo `interpretarPeriodo` —
// um inteiro de uma lista de tres. Passar a chave do URL para dentro do dominio
// seria devolver a esse modulo a responsabilidade de decidir o que "7d" quer
// dizer, que e da fronteira da URL. Aqui so entra `dias: number`, e `dias <= 0`
// e defensivo para nao virar um `GROUP BY` sobre a tabela inteira se algum
// chamador novo passar um valor estragado.
function janela(dias: number): number {
  return Number.isFinite(dias) && dias > 0 ? Math.min(Math.trunc(dias), 366) : 30;
}

/**
 * Monta a visao do dashboard para o papel do usuario.
 *
 * ponytail: `both` cai no ramo do VENDEDOR, e nao num terceiro caso "os dois".
 * Quem tem os dois papeis tem itens E da lances, e os dois conjuntos vivem lado
 * a lado no mesmo produto: a analise de venda e a principal (e a que pede
 * grafico), enquanto os lances proprios sao um complemento — a tela de comprador
 * existe para quem nao vende. Um ramo "ambos" seria uma terceira combinacao de
 * layout para um caso que a analise de vendedor ja responde.
 */
export async function resumoDoDashboard(
  analise: AnaliseRepository,
  userId: string,
  papel: PapelDoUsuario,
  dias: number,
): Promise<VisaoDoDashboard> {
  if (papel === "seller" || papel === "both") {
    const [resumo, series] = await Promise.all([
      analise.resumoDoVendedor(userId),
      analise.seriesDoVendedor(userId, janela(dias)),
    ]);
    return { papel: "vendedor", resumo, series };
  }
  return { papel: "comprador", resumo: await analise.resumoDoComprador(userId, janela(dias)) };
}
