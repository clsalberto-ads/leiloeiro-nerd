import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Carrega .env.local e .env manualmente para scripts standalone (rodados via
 * tsx, fora do Next.js). O resto do projeto não depende de um pacote dotenv
 * como dependência direta — drizzle.config.ts usa "dotenv/config" só porque
 * drizzle-kit o traz transitivamente, o que não é garantia para um script
 * nosso. Este loader evita adicionar uma dependência só para isso. Variáveis
 * já definidas no ambiente (ex.: exportadas no shell, ou no docker-compose)
 * não são sobrescritas.
 */
export function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;

    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = /^\s*(?!#)([\w.-]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;

      const key = match[1];
      let value = match[2] ?? "";
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) process.env[key] = value;
    }
  }
}
