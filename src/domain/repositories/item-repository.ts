export type ItemType = "product" | "service" | "piece";
export type ItemStatus = "draft" | "active" | "closed" | "awaiting_payment" | "paid" | "cancelled";

export interface Item {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  type: ItemType;
  imageUrl: string | null;
  minInitialBid: number;
  minBidIncrement: number;
  bidDeadline: Date;
  paymentDeadlineDays: number;
  status: ItemStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateItemInput {
  sellerId: string;
  title: string;
  description: string;
  type: ItemType;
  minInitialBid: number;
  minBidIncrement: number;
  bidDeadline: Date;
  paymentDeadlineDays?: number;
  imageUrls?: string[];
}

export interface UpdateItemInput {
  title?: string;
  description?: string;
  type?: ItemType;
  minInitialBid?: number;
  minBidIncrement?: number;
  bidDeadline?: Date;
  paymentDeadlineDays?: number;
  imageUrls?: string[];
}

export interface ItemImage {
  id: string;
  itemId: string;
  url: string;
  position: number;
  createdAt: Date;
}

// ponytail: `bidDeadline` entrou na union; `type` e `status` NAO entraram. A escolha
// entre as tres saidas do problema e o seguinte.
//
// A coluna `prazo` da tabela ordena por `bidDeadline` e o brief trazia a union sem
// esse membro. "Silenciosamente ignorar" e o pior desfecho: o `DataTable` continua
// desenhando a seta no cabecalho e o `aria-sort` continua anunciando "ascending",
// a tabela nao muda, e nada no codigo acusa — e o usuario que fica sem mais saber se
// foi ele, o servidor ou o navegador. "Devolver erro" e o mesmo defeito no outro
// extremo (um 500 num clique de cabecalho) e transformaria uma coluna de tabela em
// armadilha. Entao a union cresce para o que a coluna REALMENTE ordena: `prazo` ja
// entregava `getTime()` como `accessorFn`, entao o servidor ordena por `bid_deadline`
// e a ordem e a mesma que o cliente produzia, so que la no `ORDER BY`.
//
// `status` e `tipo` tambem tem cabecalho clicavel, e continuam fora por um motivo
// diferente do `prazo`: o `accessorFn` delas entrega o ROTULO pt-BR ("Em leilao",
// "Servico"), e o servidor so tem o enum gravado. Ordenar por `items.status` daria
// active, awaiting_payment, cancelled, closed, draft, paid — uma ordem que nao e a
// oposta da de hoje, e uma ORDEM DIFERENTE com a mesma aparencia de "esta ordenado
// por status". O usuario que hoje le "Em leilao, Encerrado, Pago" leria
// "active, cancelled, closed" e nao teria como saber que o clique funcionou. Nao ha
// ordem de status defensavel no servidor sem um CASE com os rotulos dentro do SQL.
//
// Consequencia obrigatoria para quem desenha a tabela: `status` e `tipo` precisam
// de `sortable: false`, para o cabecalho deixar de ser clicavel. A opcao que nao
// existe mais, depois desta decisao, e deixar a coluna clicavel e o clique sem efeito.
export type ItemOrderBy = "createdAt" | "title" | "minInitialBid" | "bidDeadline";
export type ItemSortDirection = "asc" | "desc";

// ponytail: os tres defaults nao sao "o mais obvio", e nenhum deles se deduz do
// outro. Vale um por um.
//
// `orderBy` ausente = `createdAt desc`. Nao virou "o mais antigo primeiro": e a
// ordem que `findBySellerId` ja tinha (`orderBy(desc(items.createdAt))`) e que a
// vitrine publica de um vendedor depende. Virar o padrao aqui mudaria a tela
// publica sem ninguem ter pedido.
//
// `direction` ausente = `asc`, para qualquer coluna pedida. Nao existe `desc`
// herdado do `orderBy`: sao duas dimensoes independentes, e quem pede `orderBy` sem
// `direction` esta pedindo a ordem natural da coluna. Quem quiser "mais recentes
// primeiro" escreve os dois campos.
//
// `limit` ausente = TODOS os itens do conjunto filtrado, e nao uma pagina de 10. Um
// default de pagina aqui truncaria em silencio quem esquecesse o `limit` — e a
// `page.tsx` de hoje e exatamente esse forgotado: o resultado seria "dos meus 12 itens
// aparecem 10", com rodape dizendo "de 12" e o sumico sem nenhuma explicacao. O 10 do
// produto ja existe em um lugar so, o `DataTable` (`TAMANHOS_DE_PAGINA`/`pageSize`),
// que e onde o usuario escolhe; repetir o numero aqui daria duas fontes de verdade
// para a mesma escolha e um lugar para elas divergirem.
//
// `total` e a contagem do conjunto filtrado ANTES de `limit`/`offset`, sempre: e o
// que o rodape usa para dizer "de 47". Um total contado antes do filtro faz o
// rodape prometer paginas que nao existem — e o usuario clica na proxima e recebe
// "Nenhum resultado".
export interface ItemListFilter {
  status?: ItemStatus;
  // ponytail: `q` e substring no TITULO, insensivel a caixa e a acento, e nao a
  // busca global que a tabela fazia no cliente (que casava com toda coluna que
  // tivesse `accessorFn`: titulo, rotulo de tipo, rotulo de status, o numero cru do
  // lance e o epoch do prazo). Encolheu de proposito: no modo servidor o
  // `DataTable` roda com `manualFiltering` e o termo vai para o `WHERE`, e o SQL nao
  // conhece "Em leilao" (esta gravado "active") nem "R$ 1.234,56" (esta gravado
  // 123456). O que se perde — e o que a Task 8 acabou de consertar de proposito — e
  // buscar "Em leilao" ou "Servico". Status continua acessivel pelas abas; tipo nao
  // tem equivalente na tela. A volta e uma `OR` por coluna no `WHERE` com os rotulos
  // pt-BR, e os rotulos vivem no componente cliente: e um movimento que depende de
  // mexer la, nao neste contrato. `q` em branco (ou so com espacos) e ausencia de
  // busca, porque o `DataTable` avisa a busca vazia ao limpar a caixa.
  q?: string;
  orderBy?: ItemOrderBy;
  direction?: ItemSortDirection;
  limit?: number;
  offset?: number;
}

// ponytail: `total` nao e "quantos itens a pagina trouxe" (isso e `items.length`) e
// nao e "quantos itens o vendedor tem" (isso e o filtro sem `status`/`q`). E o
// tamanho do conjunto JA filtrado, e e por isso que o filtro e a contagem precisam
// sair do MESMO `where` — o par `{ items, total }` e uma promessa de que os dois
// numeros falam do mesmo conjunto, e um `total` de outra query e o jeito mais barato
// de quebrar essa promessa sem nenhum teste Falhar.
export interface ItemListResult {
  items: Item[];
  total: number;
}

// ponytail: porta separada, e nao mais um metodo no `ItemRepository`. A alternativa
// obvia — mudar `findBySellerId` para devolver `{ items, total }` — foi descartada
// por custo, nao por arquitetura: existem 11 implementacoes de teste de
// `ItemRepository` espalhadas pelos use cases, todas com `implements ItemRepository`,
// e a quebra de contrato passaria a exigir reescrever 11 arquivos de teste de
// features que nao tem relacao com a tabela. Aqui os dois nomes sao entradas
// diferentes de uma unica implementacao (o `findBySellerId` do Drizzle chama o
// `listBySellerId` e fica com o `.items`), o `listActiveItemsBySellerId`, que
// precisa do conjunto inteiro, nao muda, e o `listSellerItems` passa a depender
// apenas do que ele usa.
export interface ItemLister {
  listBySellerId(sellerId: string, filter?: ItemListFilter): Promise<ItemListResult>;
}

export interface ItemRepository {
  create(input: CreateItemInput): Promise<Item>;
  update(id: string, input: UpdateItemInput): Promise<Item | null>;
  findById(id: string): Promise<Item | null>;
  findBySellerId(sellerId: string, filter?: ItemListFilter): Promise<Item[]>;
  delete(id: string): Promise<void>;
  setStatus(id: string, status: ItemStatus): Promise<Item | null>;
  countBids(itemId: string): Promise<number>;
  findImagesByItemId(itemId: string): Promise<ItemImage[]>;
  findImageById(imageId: string): Promise<ItemImage | null>;
  createImages(itemId: string, urls: string[]): Promise<ItemImage[]>;
  deleteImage(imageId: string): Promise<void>;
}