import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // ponytail: `better-auth.ts` faz fail-fast na importação quando
    // `BETTER_AUTH_SECRET` está ausente. Os testes que importam o módulo real
    // (via `auth-actions`) não têm `.env`, então este valor evita o throw sem
    // nunca exercitar criptografia de verdade.
    env: {
      BETTER_AUTH_SECRET: "vitest-test-secret",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});