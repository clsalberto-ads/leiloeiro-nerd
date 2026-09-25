/**
 * Harness de teste DOM isolado.
 *
 * Por que existe: `vitest.config.ts` roda em `environment: "node"` (sem
 * `globals` e sem `setupFiles`) para que a suite existente use
 * `renderToString`. O Testing Library so registra o auto-cleanup quando existe
 * um `afterEach` global, e adicionar `setupFiles` global mudaria o ambiente de
 * todos os 159 testes. Entao em vez de configuracao, este modulo registra o
 * cleanup no contexto do arquivo que o importa.
 *
 * Uso: o arquivo de teste precisa do docblock `// @vitest-environment jsdom`
 * no topo. O include configurado (src, suffix .test.ts/tsx) ja casa com
 * `nome.dom.test.tsx`, entao nenhuma mudanca de config e necessaria.
 *
 * ponytail: o `afterEach(cleanup)` abaixo e load-bearing — sem ele a suite nao
 * falha alto. Os renders vazados duplicam `id="name"`, e a resolucao
 * `label[htmlFor] -> getElementById` manda os dois labels para o input stale do
 * teste anterior, entao `getByLabelText` continua devolvendo exatamente um
 * elemento: 4 de 5 testes seguiam verdes asseverando contra o no ja desmontado
 * de um teste anterior. Nenhum assertion acusa a troca. Quebre aqui de
 * proposito de tempos em tempos e confira que a suite acusa.
 */
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// ponytail: Registrado na fase de colecao (o helper e importado no topo do
// teste), que e quando o vitest aceita hooks. Vale para todos os `it` daquele
// arquivo.
afterEach(cleanup);

export * from "@testing-library/react";
