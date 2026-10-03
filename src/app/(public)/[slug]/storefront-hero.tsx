import type { SellerStorefront } from "@/domain/repositories/user-repository";
import { APP_TIMEZONE } from "@/lib/timezone";

// ponytail: o hero mostra SO FATOS VERIFICAVEIS — quantos itens estao em leilao e
// desde quando o vendedor existe. Os dois sao checaveis pelo visitante na propria
// tela (a grade logo abaixo tem os itens; a data nao e mistério nenhum).
//
// E por isso que NAO ha "verificado", nem avaliacao, nem badge de seguranca. Um
// selo de confianza que o sistema nao consegue sustentar e PIOR que nenhum selo:
// ele promete um controle que nao existe, e o visitante que descobrir le nao volta.
// O que sustenta a confianza aqui e o oposto — o numero e a data sao verificaveis.
export function StorefrontHero({ seller }: { seller: SellerStorefront }) {
  const initials = seller.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex items-center gap-4" data-slot="storefront-hero">
      {seller.image ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={seller.image}
          alt={seller.name}
          className="size-20 shrink-0 rounded-full border object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex size-20 shrink-0 items-center justify-center rounded-full border bg-muted text-2xl font-semibold text-muted-foreground"
        >
          {initials}
        </div>
      )}

      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold">{seller.name}</h1>
        <p className="text-sm text-muted-foreground">{formatItemCount(seller.activeItemCount)}</p>
        <p className="text-xs text-muted-foreground">
          Membro desde{" "}
          <time dateTime={seller.createdAt.toISOString()}>{monthAndYear(seller.createdAt)}</time>
        </p>
      </div>
    </div>
  );
}

function formatItemCount(total: number): string {
  if (total === 0) return "Nenhum item em leilão";
  if (total === 1) return "1 item em leilão";
  return `${total} itens em leilão`;
}

// ponytail: o mes vem do `Intl` do proprio runtime (`toLocaleDateString` com
// `APP_TIMEZONE`), e nao de um array de meses escrito a mao: um array envelhece com o
// runtime e erra assim que o `Intl` trocar de versao — o mesmo bug do
// `getUTCDate` que o `APP_TIMEZONE` ja eliminou do resto do app, so que na versao de
// calendario. O `Intl` tambem e quem acerta o "de" e o ano; aqui so falta a
// inicial maiuscula, que o pt-BR do `Intl` devolve em minuscula ("janeiro de
// 2026") e que o leitor ve depois de "Membro desde".
function monthAndYear(data: Date): string {
  const text = data.toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, month: "long", year: "numeric" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}