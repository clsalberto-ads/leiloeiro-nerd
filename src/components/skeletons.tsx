import { Skeleton } from "@/components/ui/skeleton";

// ponytail: NAO existe `TableSkeleton` aqui, e a ausencia e uma decisao, nao uma
// pendencia. O plano pedia um esqueleto para o dashboard; o lugar dele seria este
// arquivo, e ele nao foi escrito porque nao teria para que servir: a fronteira
// `<Suspense>` do dashboard seria decorativa (o `await` da pagina acontece antes
// do JSX existir, entao nada abaixo suspende e o fallback nunca sai), e a unica
// forma de torna-la real — descer a consulta para um filho async — quebra o
// `items/page.test.tsx`, que esta entre os testes protegidos: o
// `renderToStaticMarkup` dele (linha 206) tem de conter "Console retrô" e um filho
// async sempre entrega o fallback, e o `achar(elemento, ItensDaUrl)` (linha 104)
// acha o componente por tipo so andando por `props.children`.
//
// O `loading.tsx` do segmento tambem nao serve, e por um motivo diferente: no modo
// servidor a lista navega com `router.push` a cada busca, e um `loading.tsx`
// remonta o `DataTable` inteiro a cada tecla depurada — apagando o `query` local e
// desfazendo o conserto de "busca nao descarta digitacao em voo" (commit
// `f7f300a`). Alem disso, durante a navegacao o usuario ve hoje a lista antiga, que
// e mais util que um esqueleto.
//
// O upgrade path e o mesmo da vitrine (`[slug]/page.tsx`): filho async, e vir
// junto com a reescrita do `items/page.test.tsx`, num dia em que esse arquivo
// puder mudar.

// ponytail: 6 e o numero de cards que o usuario espera numa vitrine: duas fileiras
// da grade de tres colunas no `lg`. O numero e deste lado de proposito — um
// esqueleto de 3 cards numa tela que aceita 9, ou de 12 numa que mostra 6, faz a
// grade pular de tamanho no instante em que o conteudo chega, que e a unica coisa
// que o esqueleto nao pode fazer. Se a vitrine passar a paginar, este e o numero
// a trocar.
const CARDS = 6;

// ponytail: o `aria-hidden` no card e o que impede o leitor de tela de descer
// pelos seis blocos vazios procurando informacao que nao existe ali. O anuncio de
// "carregando" e do CONTAINER (o unico `role="status"`), e nao de cada card:
// seis regioes vivas repetiriam a mesma frase seis vezes.
function SkeletonCard() {
  return (
    <div data-slot="item-card-skeleton" aria-hidden="true" className="overflow-hidden rounded-lg border">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-4/5" />
        {/* ponytail: a barra do lance ATUAL e mais alta e mais larga que a do
        lance minimo, na ordem em que o card novo mostra as duas. Um esqueleto com
        as duas do mesmo tamanho denunciaria que ele e de um card que nao existe
        mais — e a troca do bloco largo pelo estreito no instante do conteudo e
        exatamente o salto de layout que o esqueleto existe para evitar. */}
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

// ponytail: as quatro barras por card sao a forma do `PublicItemCard` — imagem
// quadrada, titulo, lance atual e lance minimo. Um esqueleto com a contagem errada ainda
// "funciona" (a grade aparece, o usuario espera), mas a troca entre o bloco largo
// e o curto denuncia que o esqueleto era outro conteudo.
export function ItemCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando itens"
      className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: CARDS }, (_, indice) => (
        <SkeletonCard key={indice} />
      ))}
    </div>
  );
}
