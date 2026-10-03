import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".worktrees/**",
  ]),
  {
    rules: {
      // O `_` e o pedido explicito de "o contrato exige este parametro, o fake
      // ignora". Sem essa excecao, todo `async findById(_id) { return null; }`
      // dos fakes de repositorio vira warning, e a unica forma de calar o lint
      // seria apagar o parametro — apagando tambem a documentacao da assinatura.
      // ponytail: o prefixo conta como intencao declarada, nao como esquecimento.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
