import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GavelIcon, SearchIcon } from "lucide-react";
import { getStorefrontSellerAction, listStorefrontItemsAction } from "@/presentation/actions/public-actions";
import { PublicItemCard } from "@/components/public-item-card";
import { EmptyState } from "@/components/empty-state";
import { ItemCardSkeleton } from "@/components/skeletons";
import { firstValue } from "@/lib/first-value";
import { StorefrontControls } from "./storefront-controls";
import { buildStorefrontHref, parseStorefrontView, type StorefrontView } from "./storefront-state";
import { StorefrontHero } from "./storefront-hero";

export const dynamic = "force-dynamic";

// ponytail: a listagem mora num COMPONENTE SEPARADO, e essa e a unica razao de
// ela existir. Uma fronteira `<Suspense>` so serve se algo ABAIXO dela suspender,
// e um `await` no corpo da propria pagina acontece antes do JSX existir — a
// fronteira, nesse caso, e decorativa: o esqueleto nunca aparece. Colocando o
// `await` dentro de um filho async, o filho e que suspende, e o fallback sai no
// primeiro flush enquanto a consulta responde.
//
// ponytail: e por isso que o HERO e os CONTROLES ficam FORA da fronteira. Medido
// nesta suite (com `renderToPipeableStream`, o renderizador que o Next usa): uma
// fronteira sozinha, sem nada em volta, recebe `onShellReady` e NAO despeja o
// fallback — o React espera e entrega o conteudo pronto num unico flush. Com
// conteudo no shell (o hero, que carrega o `<h1>`), o primeiro flush leva o
// esqueleto e o segundo traz os cards.
async function StorefrontList({
  sellerId,
  slug,
  view,
}: {
  sellerId: string;
  slug: string;
  view: StorefrontView;
}) {
  const items = await listStorefrontItemsAction(sellerId, view);

  // ponytail: a vitrine vazia tem DOIS motivos, e os dois nao podem dizer a mesma
  // frase. Com a busca vinda da URL, "o vendedor nao tem nada" e "nada casou com
  // o que voce procurou" chegam no mesmo lugar — e so um deles tem para onde
  // voltar. O texto unico mandava quem procurava um item que nao existe ler "ele
  // nao tem item nenhum", que e uma acusacao falsa sobre o vendedor.
  if (items.length === 0) {
    const filtered = view.q !== "";
    return (
      <EmptyState
        title={filtered ? "Nenhum item encontrado" : "Nenhum item em leilão"}
        description={
          filtered
            ? "Nada casou com essa busca. Tente outro termo."
            : "Assim que ele leiloar algo, os itens aparecem aqui."
        }
        icon={
          filtered ? (
            <SearchIcon aria-hidden="true" className="size-6 text-muted-foreground" />
          ) : (
            <GavelIcon aria-hidden="true" className="size-6 text-muted-foreground" />
          )
        }
        // ponytail: o "voltar" e um LINK, e nao um botao que chama `navigate`: um
        // link tem as afinidades que o botao nao tem (abrir em nova aba, clique do
        // meio, ctrl-clique, copiar endereco, rastreamento) sem ganhar nada em
        // troca, porque a propriedade que importa e "a URL e escrita num lugar so" —
        // e ela continua sendo o `buildStorefrontHref`, chamado com a vista sem filtro (que
        // e a MESMA frase de URL com outra vista, nao uma segunda copia).
        //
        // E sem busca nao ha acao, e a decisao e a original do `page.tsx:26-31`: o
        // visitante de uma vitrine sem itens nao tem nada a fazer — nao ha onde
        // criar, nao ha busca e a pagina inicial e um cartao de boas-vindas. Um
        // link ali seria uma saida para lugar nenhum.
        action={
          filtered
            ? { label: "Limpar busca", href: buildStorefrontHref(slug, { q: "", sort: view.sort }) }
            : undefined
        }
      />
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item: import("@/domain/repositories/item-repository").StorefrontItem) => (
        <PublicItemCard key={item.id} item={item} slug={slug} />
      ))}
    </div>
  );
}

export default async function StorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  // ponytail: o `notFound()` e do SHELL, e nao da fronteira, por causa do STATUS
  // CODE. A documentacao do proprio Next 16 ("Calling `notFound()` after streaming
  // has started") mostra o outro desenho — a checagem dentro da fronteira — e
  // nomeia a conta: "the response has already begun streaming as a 200, and the
  // status can't change once streaming has started" (a resposta ja comecou a
  // ser enviada como 200, e o status nao pode mais mudar), com um `notFound()` para segurar
  // o soft 404. Esta e a rota mais rastreada do produto, e um soft 404 com 200 e
  // uma vitrine inexistente e um indexavel como pagina valida.
  const seller = await getStorefrontSellerAction(slug);
  if (!seller) notFound();

  // ponytail: a URL e lida AQUI, no shell, e a `vista` e passada para a fronteira.
  // Ler dentro do filho daria duas leituras do mesmo parametro e a URL poderia
  // mudar entre elas. E a `vista` do shell e a que o `<form>` e os `<Link>` dos
  // controles usam, entao o que a tela mostra e o que a lista filtra.
  //
  // ponytail: o `searchParams` e esperado no SHELL e nao na fronteira, e por
  // causa do `force-dynamic` + do `notFound()`. Numa rota dinamica o Next le o
  // `searchParams` antes de comecar a renderizar, entao o 404 sai com o codigo
  // certo; se ele vivesse dentro da fronteira, a resposta ja teria comecado a
  // sair com 200.
  const urlParams = await searchParams;
  const view = parseStorefrontView((name) => firstValue(urlParams[name]));

  return (
    <div className="space-y-6">
      <StorefrontHero seller={seller} />
      <StorefrontControls slug={slug} view={view} />
      <Suspense fallback={<ItemCardSkeleton />}>
        <StorefrontList sellerId={seller.id} slug={slug} view={view} />
      </Suspense>
    </div>
  );
}
