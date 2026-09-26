import { Skeleton } from "@/components/ui/skeleton";

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
function CartaoEsqueleto() {
  return (
    <div data-slot="item-card-skeleton" aria-hidden="true" className="overflow-hidden rounded-lg border">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

// ponytail: as tres barras por card sao a forma do `PublicItemCard` — imagem
// quadrada, titulo e lance minimo. Um esqueleto com a contagem errada ainda
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
        <CartaoEsqueleto key={indice} />
      ))}
    </div>
  );
}
