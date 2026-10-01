// Adapter Drizzle: mapeamos explicitamente os modelos do Better Auth
// para as tabelas do auth-schema.ts, que é o arquivo gerado pelo
// @better-auth/cli e NÃO deve ser editado manualmente.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/infrastructure/database/drizzle";
import { user, session, account, verification } from "@/infrastructure/database/auth-schema";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // Placeholder até a Fase 3 (Resend): loga o link de redefinição no console.
    // ponytail: o `throw` em produção é o ponto inteiro deste callback. A `url` aqui
    // é o token de redefinição — quem lê o stdout do processo toma conta da conta
    // de quem pediu a redefinição, e o prefixo "[DEV]" não protege nada porque não
    // havia guard nenhum: em produção o token ia inteiro para o log. Falhar
    // fechado (nenhum e-mail sai, o chamador vê o erro) é o único jeito seguro de
    // não ter o provedor de e-mail ainda. O upgrade path é o Resend na Fase 3,
    // que troca o `throw` por um `send` — e o `throw` some junto, porque ele só
    // existe para este placeholder.
    sendResetPassword: async ({ url }) => {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Envio de redefinição de senha não configurado (Fase 3 / Resend)");
      }
      console.log("[DEV] link de redefinição de senha:", url);
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "bidder", input: false },
      slug: { type: "string", required: false, unique: true },
      phone: { type: "string", required: false },
      address: { type: "string", required: false },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  plugins: [nextCookies()],
});