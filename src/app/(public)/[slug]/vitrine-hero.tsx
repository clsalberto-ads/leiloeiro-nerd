import type { VitrineDeVendedor } from "@/domain/repositories/user-repository";
import { FUSO } from "@/lib/fuso";

// ponytail: o hero mostra SO FATOS VERIFICAVEIS — quantos itens estao em leilao e
// desde quando o vendedor existe. Os dois sao checaveis pelo visitante na propria
// tela (a grade logo abaixo tem os itens; a data nao e mistério nenhum).
//
// E por isso que NAO ha "verificado", nem avaliacao, nem badge de seguranca. Um
// selo de confianza que o sistema nao consegue sustentar e PIOR que nenhum selo:
// ele promete um controle que nao existe, e o visitante que descobrir le nao volta.
// O que sustenta a confianza aqui e o oposto — o numero e a data sao verificaveis.
export function VitrineHero({ vendedor }: { vendedor: VitrineDeVendedor }) {
  const iniciais = vendedor.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex items-center gap-4" data-slot="vitrine-hero">
      {vendedor.image ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={vendedor.image}
          alt={vendedor.name}
          className="size-20 shrink-0 rounded-full border object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex size-20 shrink-0 items-center justify-center rounded-full border bg-muted text-2xl font-semibold text-muted-foreground"
        >
          {iniciais}
        </div>
      )}

      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold">{vendedor.name}</h1>
        <p className="text-sm text-muted-foreground">{contarItens(vendedor.totalDeItensAtivos)}</p>
        <p className="text-xs text-muted-foreground">
          Membro desde{" "}
          <time dateTime={vendedor.criadoEm.toISOString()}>{mesEAno(vendedor.criadoEm)}</time>
        </p>
      </div>
    </div>
  );
}

function contarItens(total: number): string {
  if (total === 0) return "Nenhum item em leilão";
  if (total === 1) return "1 item em leilão";
  return `${total} itens em leilão`;
}

// ponytail: o mes vem do `Intl` do proprio runtime (`toLocaleDateString` com
// `FUSO`), e nao de um array de meses escrito a mao: um array envelhece com o
// runtime e erra assim que o `Intl` trocar de versao — o mesmo bug do
// `getUTCDate` que o `FUSO` ja eliminou do resto do app, so que na versao de
// calendario. O `Intl` tambem e quem acerta o "de" e o ano; aqui so falta a
// inicial maiuscula, que o pt-BR do `Intl` devolve em minuscula ("janeiro de
// 2026") e que o leitor ve depois de "Membro desde".
function mesEAno(data: Date): string {
  const texto = data.toLocaleDateString("pt-BR", { timeZone: FUSO, month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}