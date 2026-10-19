# Chatbot de IA com RAG

Assistente virtual do Leiloeiro Nerd: um widget flutuante, no canto inferior direito de todas as páginas, que responde dúvidas sobre cadastro, lances, pagamento, retirada e regras da plataforma. As respostas são baseadas em arquivos Markdown (`knowledge/`), recuperados por busca semântica (RAG).

O chatbot **não** consulta dados dinâmicos (lance atual, status ou prazo de um item). Para isso o assistente diz que não tem acesso e orienta a consultar a página do item. Esses dados virão de Tools/API numa etapa futura, não do RAG.

## Como funciona

```text
Usuário
  ↓
Widget (src/components/chat)
  ↓
POST /api/chat                      src/app/api/chat/route.ts
  ↓
Valida e limita as mensagens        (últimas 20, até 2000 caracteres cada)
  ↓
Embedding da pergunta               Gemini  (GEMINI_API_KEY)
  ↓
Similaridade de cosseno             contra data/knowledge-index.json
  ↓
Filtra por RAG_MIN_SCORE, top RAG_TOP_K
  ↓
Monta o contexto + system prompt    src/lib/ai/prompt.ts
  ↓
Resposta                            OpenRouter  (OPENROUTER_API_KEY)
  ↓
Widget
```

São duas chamadas de IA, com provedores e chaves independentes:

| Etapa                          | Provedor                                    | Chave                   |
| ------------------------------ | ------------------------------------------- | ----------------------- |
| Embeddings (indexação e busca) | Gemini, pelo endpoint compatível com OpenAI | `GEMINI_API_KEY` |
| Resposta final do chat         | OpenRouter                                  | `OPENROUTER_API_KEY`    |

Pontos importantes do comportamento:

- A busca usa **só a última mensagem do usuário**. Uma pergunta de acompanhamento sem contexto próprio ("e o prazo?") pode não achar nada, mesmo que a conversa anterior deixe claro o assunto.
- Se nenhum trecho passar do threshold, o prompt avisa a IA para dizer que não encontrou a informação, em vez de inventar.
- Se a busca falhar por outro motivo (chave inválida, limite do plano gratuito), o chat **continua sem contexto** e o erro aparece só no terminal do servidor.
- Se o índice não existir, a rota responde 500 pedindo para rodar `pnpm knowledge:index`.
- O índice é lido uma vez e mantido em memória pelo servidor. Depois de reindexar, reinicie o `pnpm dev` (ou o servidor de produção).

## Configuração

Variáveis no `.env` (modelo em `.env.example`):

| Variável                 | Obrigatória | Padrão                               | Para que serve                                   |
| ------------------------ | ----------- | ------------------------------------ | ------------------------------------------------ |
| `OPENROUTER_API_KEY`     | sim         | n/d                                  | Resposta final do chat                           |
| `OPENROUTER_MODEL`       | não         | `openrouter/auto`                    | Modelo usado na resposta                         |
| `GEMINI_API_KEY`  | sim         | n/d                                  | Embeddings (chave do Google AI Studio)           |
| `EMBEDDING_MODEL` | não         | `gemini-embedding-001`               | Modelo de embeddings                             |
| `OPENAI_BASE_URL`        | não         | endpoint OpenAI-compatível do Gemini | Troca de provedor de embeddings                  |
| `RAG_TOP_K`              | não         | `5`                                  | Máximo de trechos enviados à IA                  |
| `RAG_MIN_SCORE`          | não         | `0.7`                                | Similaridade mínima (0 a 1) para um trecho valer |
| `RAG_KNOWLEDGE_DIR`      | não         | `knowledge`                          | Pasta dos Markdown                               |
| `RAG_INDEX_PATH`         | não         | `data/knowledge-index.json`          | Arquivo do índice                                |

O nome `OPENAI_*` vem do SDK usado: os embeddings são chamados pelo pacote `openai`, apontado para o Gemini.

## Primeira execução

```bash
pnpm install
cp .env.example .env        # preencha as duas chaves
pnpm knowledge:index        # gera data/knowledge-index.json
pnpm knowledge:search "Como faço para participar?"   # confere os scores
pnpm dev
```

## Base de conhecimento

Os arquivos ficam em `knowledge/`, organizados por assunto:

```text
knowledge/
├── faq/            cadastro, participacao, lances, pagamento
├── plataforma/     como-funciona, retirada
├── regras/         regras-gerais, regras-lances
└── leiloes/        exemplo
```

> O conteúdo atual é fictício, só para demonstrar o RAG. Substitua pelos textos reais da plataforma (e remova os avisos de "conteúdo fictício") antes de ir para produção.

### Adicionar ou alterar conhecimento

1. Crie ou edite um `.md` em qualquer subpasta de `knowledge/`.
2. Rode `pnpm knowledge:index`.
3. Reinicie o servidor.

Não é preciso mexer em código. O índice inteiro é regenerado a cada execução.

### Como escrever bons arquivos

O indexador divide cada arquivo **por cabeçalho** (`#`, `##`, ...): cada seção vira um trecho independente, que carrega o título do documento e o nome da seção como metadados. Seções com mais de 1200 caracteres são subdivididas por parágrafo.

- Um assunto por arquivo, com um `# Título` claro.
- Um `##` por pergunta ou tópico, com o nome que o usuário usaria ("Prazo de pagamento", não "Item 3.2").
- Cada seção deve fazer sentido sozinha, porque só os trechos mais parecidos com a pergunta chegam à IA.
- Não escreva valores ou prazos que mudam por leilão como se fossem fixos. Diga que variam e remeta ao edital.
- Evite dados dinâmicos (lance atual, status). Eles não pertencem a este fluxo.

## Scripts

| Comando                            | O que faz                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm knowledge:index`             | Lê todos os `.md`, divide em trechos, gera os embeddings e grava `data/knowledge-index.json`                                 |
| `pnpm knowledge:search "pergunta"` | Mostra o ranking de similaridade da pergunta, sem aplicar o threshold, com ✔ nos trechos que passam do `RAG_MIN_SCORE` atual |

Os dois carregam o `.env.local` e o `.env` sozinhos (`scripts/load-env.ts`).

### Calibrar o `RAG_MIN_SCORE`

Cada provedor de embeddings tem sua própria escala de similaridade, então o `0.7` inicial pode ser alto ou baixo demais. Para ajustar:

1. Rode `pnpm knowledge:search` com uma pergunta que **está** na base e anote o score do trecho certo.
2. Rode com uma pergunta que **não está** (por exemplo, "Qual o lance atual do item 123?") e anote o maior score.
3. Defina `RAG_MIN_SCORE` num valor entre os dois.

Refaça a conferência sempre que trocar o modelo de embeddings ou mudar bastante a base.

## Estrutura do código

```text
src/
├── app/api/chat/route.ts        rota: valida, busca, monta o prompt, chama a IA
├── components/chat/             widget, janela, input e mensagens
├── domain/
│   ├── chat/types/chat.ts       tipos das mensagens
│   └── rag/types.ts             tipos do RAG e a interface KnowledgeRetriever
└── lib/
    ├── ai/
    │   ├── client.ts            cliente do chat (OpenRouter)
    │   └── prompt.ts            system prompt e regras anti-invenção
    └── rag/
        ├── config.ts            leitura das variáveis RAG_*
        ├── markdown.ts          divide o Markdown em seções por cabeçalho
        ├── chunking.ts          transforma seções em trechos com metadados
        ├── openai-client.ts     cliente dos embeddings (Gemini)
        ├── embeddings.ts        única chamada à API de embeddings
        ├── similarity.ts        similaridade de cosseno (sem dependência de provedor)
        ├── retriever.ts         LocalKnowledgeRetriever (lê o índice JSON)
        ├── search.ts            searchKnowledge e buildContextBlock
        └── index.ts             exportações do módulo
knowledge/                       base de conhecimento em Markdown
data/knowledge-index.json        índice gerado (não versionado)
scripts/
├── index-knowledge.ts           indexação
├── search-knowledge.ts          diagnóstico de scores
└── load-env.ts                  carrega .env em scripts standalone
```

Cada trecho do índice guarda `id`, `source` (caminho do arquivo), `title`, `section`, `content` e o vetor `embedding`. A interface do widget ainda não mostra as fontes, mas os metadados já estão preservados para isso.

## Testes

```bash
pnpm test
```

Os testes do chatbot não chamam nenhuma API (tudo é simulado) e rodam sem chaves:

| Arquivo                          | Cobre                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `src/lib/rag/chunking.test.ts`   | Divisão por seção, ids, seções longas, arquivos vazios                           |
| `src/lib/rag/similarity.test.ts` | Similaridade de cosseno                                                          |
| `src/lib/rag/embeddings.test.ts` | Lote, reordenação, fallback para um request por texto, propagação de 401/429/500 |
| `src/lib/rag/retriever.test.ts`  | Threshold, topK, ordenação, índice ausente                                       |
| `src/lib/rag/search.test.ts`     | `searchKnowledge` e formatação do contexto                                       |
| `src/app/api/chat/route.test.ts` | Validação da entrada, integração com o RAG, erros da IA                          |

## Problemas comuns

| Sintoma                                                     | Causa provável                                                                       | O que fazer                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `429 ... credit_balance_exhausted` ao indexar               | Provedor de embeddings sem créditos (ou limite do plano gratuito)                    | Confira a chave e a cota no provedor; espere o limite renovar       |
| `GEMINI_API_KEY não configurada.`                    | Chave ausente no `.env`                                                              | Preencha e rode o comando de novo                                   |
| Chat responde 500 "Base de conhecimento ainda não indexada" | `data/knowledge-index.json` não existe                                               | `pnpm knowledge:index`                                              |
| Erro "conta da OpenRouter está sem créditos" no widget      | `openrouter/auto` precisa de créditos comprados                                      | Compre créditos (openrouter.ai/settings/credits) ou use um modelo `:free` em OPENROUTER_MODEL |
| Erro "Chave da OpenRouter inválida" no widget             | `OPENROUTER_API_KEY` incorreta                                                       | Confira a chave em openrouter.ai/keys e o `.env`                     |
| Chat diz "não encontrei" para tudo                          | Busca falhando em silêncio, threshold alto demais, ou índice gerado com outro modelo | Veja o terminal do servidor; rode `pnpm knowledge:search`; reindexe |
| Mudou um `.md` e a resposta não mudou                       | Índice não regenerado, ou servidor com o índice antigo em memória                    | `pnpm knowledge:index` e reinicie o servidor                        |
| Trocou o modelo de embeddings e a busca parou               | Vetores de tamanhos diferentes no índice                                             | Reindexe com o modelo novo (o erro aparece só no terminal)          |
| Chat traz trechos sem relação com a pergunta                | Threshold baixo demais                                                               | Calibre o `RAG_MIN_SCORE`                                           |

## Limitações conhecidas

- A busca considera só a última mensagem, sem o histórico da conversa.
- A camada de compatibilidade OpenAI do Gemini está em beta e não documenta `input` em lote para embeddings. O código tenta o lote e cai para um request por texto se o provedor recusar, o que deixa a indexação mais lenta em bases grandes.
- O índice em JSON é lido inteiro na memória. Serve bem para dezenas ou poucas centenas de trechos.
- O `data/knowledge-index.json` não é versionado: gere o índice em cada ambiente (desenvolvimento, CI, produção) depois do deploy.

## Próximos passos

- **PostgreSQL + pgvector:** a busca passa pela interface `KnowledgeRetriever` (`src/domain/rag/types.ts`). Basta criar uma `PgVectorKnowledgeRetriever` que implemente `search()` e trocá-la em `src/lib/rag/search.ts`; a rota e o chatbot não mudam. O vetor ficaria numa coluna `vector` da mesma base já usada pelo Drizzle.
- **Dados dinâmicos:** consulta de itens, lances, status e prazos via Tools/API, separada do RAG (que continua cobrindo FAQ, regras e editais).
- **Mostrar as fontes** da resposta no widget, usando os metadados já guardados.
- **Usar o histórico na busca**, reescrevendo a pergunta de acompanhamento antes de gerar o embedding.
