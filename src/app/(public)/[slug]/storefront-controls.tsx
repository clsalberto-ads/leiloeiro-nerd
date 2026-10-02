import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildStorefrontHref,
  STOREFRONT_SORT_OPTIONS,
  type StorefrontSort,
  type StorefrontView,
} from "./storefront-state";

// ponytail: os rotulos sao o CONTRATO VISVEL do parametro `ordenar`, e ele mora
// aqui e nao em `storefront-state.ts` porque sao duas metades diferentes: o
// parametro e a Maquina (o que o leitor aceita), o rotulo e a tela (o que o
// visitante le). Um teste de `estado-da-vitrine` que escrevesse "Maior lance"
// passaria se os dois lados divergirem — so a leitura dos dois arquivos diz qual
// e a fonte. O `storefront-controls.dom.test.tsx` e o que amarra as duas.
export const SORT_LABELS: Record<StorefrontSort, string> = {
  prazo: "Termina em breve",
  lance: "Maior lance",
  recentes: "Recentes",
};

// ponytail: `[...STOREFRONT_SORT_OPTIONS]`, e nao o trio escrito a mao. A lista vive em
// `storefront-state.ts` porque e a fonte unica da uniao E do `Set` de validacao
// (ver o `ponytail:` de la); copia-la aqui seria a segunda fonte, e uma ordenacao
// acrescentada na lista apareceria no tipo e na validacao e nao nesta tela — o mesmo
// modo de falha silenciosa que o achado 4 da revisao do Batch A removeu deste lado.
// O `as const` da lista impede reordenacao, entao a ordem visual e a ordem da uniao.
// O `[...]` e porque `STOREFRONT_SORT_OPTIONS` e `readonly` e o `map` aceita readonly.
const VISUAL_SORT_ORDER: readonly StorefrontSort[] = STOREFRONT_SORT_OPTIONS;

// ponytail: a busca e um `<form method="get">` e nao um input controlado com
// `onChange` + `router.push`. O form entrega o comportamento de navegacao de graca
// (botao de submit do teclado, botao direito -> "abrir em nova aba", Enter no
// campo) e a URL e escrita pelo NAVEGADOR, num lugar so. Um `useState` + `push`
// reimplementaria tudo isso e ainda criaria a classe de bug em que a digitacao se
// perde no meio da navegacao — que e o defeito que o `commit f7f300a` do dashboard
// consertou do outro lado.
export function StorefrontControls({ slug, view }: { slug: string; view: StorefrontView }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <form method="get" action={`/${slug}`} className="flex items-center gap-2">
        <label htmlFor="busca-vitrine" className="sr-only">
          Buscar item
        </label>
        <Input
          id="busca-vitrine"
          name="q"
          type="search"
          defaultValue={view.q}
          placeholder="Buscar item"
          className="w-48"
        />
        {/* ponytail: o `ordenar` viaja como campo ESCONDIDO, e e o que impede a
        busca de trocar a ordem que o visitante escolheu. O form GET so envia o que
        tem `name`, entao sem este campo a busca voltaria para "Termina em breve".
        E ele so aparece quando a ordem NAO e o padrao: mandar `ordenar=prazo`
        produziria uma URL que a leitura reescreve identica, e a mesma tela teria
        duas formas de URL. */}
        {view.sort !== "prazo" ? <input type="hidden" name="ordenar" value={view.sort} /> : null}
        <Button type="submit" variant="outline" size="sm">
          Buscar
        </Button>
      </form>

      {/* ponytail: a ordenacao sao `<Link>`, e nao `<Select>` nem botoes com
      onClick. Um link entrega prefetch, historico, ctrl-clique e "abrir em nova
      aba"; um `Select` do shadcn e estado de CLIENT e perderia o "voltar" — que e
      justamente o principio de "user control and freedom" que a URL comprou. */}
      <nav aria-label="Ordenar itens" className="flex flex-wrap gap-2">
        {VISUAL_SORT_ORDER.map((sort) => (
          <Link
            key={sort}
            href={buildStorefrontHref(slug, { ...view, sort })}
            aria-current={view.sort === sort ? "true" : undefined}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              view.sort === sort
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {SORT_LABELS[sort]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
