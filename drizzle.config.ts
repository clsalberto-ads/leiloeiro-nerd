import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/infrastructure/database/schema.ts", "./src/infrastructure/database/auth-schema.ts"],
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});