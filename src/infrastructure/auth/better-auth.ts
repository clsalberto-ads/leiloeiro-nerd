import { betterAuth } from "better-auth";

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
});