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
    sendResetPassword: async ({ url }) => {
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