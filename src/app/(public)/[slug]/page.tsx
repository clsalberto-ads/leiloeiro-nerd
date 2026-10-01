import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GavelIcon, SearchIcon } from "lucide-react";
import { getVitrineSellerAction, listVitrineItemsAction } from "@/presentation/actions/public-actions";
import { PublicItemCard } from "@/components/public-item-card";
import { EmptyState } from "@/components/empty-state";
import { ItemCardSkeleton } from "@/components/skeletons";
import { primeiroValor } from "@/lib/primeiro-valor";
import { ControlesDaVitrine } from "./controles-da-vitrine";
import { hrefDaVista, interpretarVitrine, type VistaDaVitrine } from "./estado-da-vitrine";
import { VitrineHero } from "./vitrine-hero";

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
async function ListaDaVitrine({
  sellerId,
  slug,
  vista,
}: {
  sellerId: string;
  slug: string;
  vista: VistaDaVitrine;
}) {
  const items = await listVitrineItemsAction(sellerId, vista);

  // ponytail: a vitrine vazia tem DOIS motivos, e os dois nao podem dizer a mesma
  // frase. Com a busca vinda da URL, "o vendedor nao tem nada" e "nada casou com
  // o que voce procurou" chegam no mesmo lugar — e so um deles tem para onde
  // voltar. O texto unico mandava quem procurava um item que nao existe ler "ele
  // nao tem item nenhum", que e uma acusacao falsa sobre o vendedor.
  if (items.length === 0) {
    const filtrada = vista.q !== "";
    return (
      <EmptyState
        title={filtrada ? "Nenhum item encontrado" : "Nenhum item em leilão"}
        description={
          filtrada
            ? "Nada casou com essa busca. Tente outro termo."
            : "Assim que ele leiloar algo, os itens aparecem aqui."
        }
        icon={
          filtrada ? (
            <SearchIcon aria-hidden="true" className="size-6 text-muted-foreground" />
          ) : (
            <GavelIcon aria-hidden="true" className="size-6 text-muted-foreground" />
          )
        }
        // ponytail: o "voltar" e um LINK, e nao um botao que chama `navegar`: um
        // link tem as afinidades que o botao nao tem (abrir em nova aba, clique do
        // meio, ctrl-clique, copiar endereco, rastreamento) sem ganhar nada em
        // troca, porque a propriedade que importa e "a URL e escrita num lugar so" —
        // e ela continua sendo o `hrefDaVista`, chamado com a vista sem filtro (que
        // e a MESMA frase de URL com outra vista, nao uma segunda copia).
        //
        // E sem busca nao ha acao, e a decisao e a original do `page.tsx:26-31`: o
        // visitante de uma vitrine sem itens nao tem nada a fazer — nao ha onde
        // criar, nao ha busca e a pagina inicial e um cartao de boas-vindas. Um
        // link ali seria uma saida para lugar nenhum.
        action={
          filtrada
            ? { label: "Limpar busca", href: hrefDaVista(slug, { q: "", ordenar: vista.ordenar }) }
            : undefined
        }
      />
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <PublicItemCard key={item.id} item={item} slug={slug} />
      ))}
    </div>
  );
}

export default async function VitrinePage({
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
  // status can't change once streaming has started", com um `noindex` para segurar
  // o soft 404. Esta e a rota mais rastreada do produto, e um soft 404 com 200 e
  // uma vitrine inexistente e um indexavel como pagina valida.
  const vendedor = await getVitrineSellerAction(slug);
  if (!vendedor) notFound();

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
  const paramsDaUrl = await searchParams;
  const vista = interpretarVitrine((nome) => primeiroValor(paramsDaUrl[nome]));

  return (
    <div className="space-y-6">
      <VitrineHero vendedor={vendedor} />
      <ControlesDaVitrine slug={slug} vista={vista} />
      <Suspense fallback={<ItemCardSkeleton />}>
        <ListaDaVitrine sellerId={vendedor.id} slug={slug} vista={vista} />
      </Suspense>
    </div>
  );
}
