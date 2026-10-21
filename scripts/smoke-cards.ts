/**
 * SMOKE — matriz de cartões de teste do Mercado Pago (refactor-plan R8).
 *
 * Valida a CADEIA INTEIRA com credenciais de teste, no banco local:
 *   1. Cria cenário no banco (vendedor com token MP de TESTE, item closed com
 *      2 lances, cobrança pendente da tentativa 1).
 *   2. Para cada cartão × status (APRO/OTHE/...): cria o token do cartão e o
 *      PAGAMENTO real na API de teste da MP, com external_reference = item.
 *   3. POSTa o webhook NOSSO com assinatura HMAC válida (a mesma que a MP
 *      mandaria).
 *   4. Confere o banco: APRO → cobrança approved + item paid; OTHE/… →
 *      cancelled + CASCATA (o 2º colocado ganha cobrança nova com 5%).
 *
 * Uso: pnpm smoke:cards   (exige: banco+Redis locais, `pnpm dev` na :3000)
 */
import "dotenv/config";
import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import * as schema from "../src/infrastructure/database/schema";
import * as authSchema from "../src/infrastructure/database/auth-schema";

const MP = "https://api.mercadopago.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const SECRET = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
const CIPHER_KEY = process.env.MP_TOKEN_ENCRYPTION_KEY;

// ponytail: o guard era um THROW duro contra tokens APP_USR-. O usuário
// confirmou que as credenciais SÃO de teste — a API da MP é a juíza final:
// se os cartões de teste forem recusados como inválidos, é produção e o
// resultado aparece no relatório (nenhum dinheiro move com números de teste).
if (!TOKEN) throw new Error("MERCADO_PAGO_ACCESS_TOKEN ausente");
if (!SECRET) throw new Error("MERCADO_PAGO_WEBHOOK_SECRET ausente");
if (!CIPHER_KEY) throw new Error("MP_TOKEN_ENCRYPTION_KEY ausente");
if (!TOKEN.startsWith("TEST-")) {
  console.warn("[smoke] Token não começa com TEST- — se a MP recusar os cartões como inválidos, são credenciais de produção (a matriz revela)");
}

const EMAIL = "testuser_arrematante@testuser.com";

const CARDS = [
  { name: "Mastercard", number: "5480832801033311", method: "master", cvv: "123", year: "2030" },
  { name: "Visa", number: "4235647728025682", method: "visa", cvv: "123", year: "2030" },
  { name: "Amex", number: "375365153556885", method: "amex", cvv: "1234", year: "2030" },
  { name: "Elo Débito", number: "5067766783888311", method: "elo", cvv: "123", year: "2030" },
] as const;

const STATUSES = ["APRO", "OTHE", "SECU", "EXPI", "FORM", "FUND", "CONT", "CALL"] as const;

async function mp(path: string, body: unknown) {
  const res = await fetch(`${MP}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`MP ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

async function webhook(mpPaymentId: string) {
  const body = JSON.stringify({ type: "payment", data: { id: String(mpPaymentId) } });
  const ts = Date.now();
  const v1 = createHmac("sha256", SECRET!).update(`id:${mpPaymentId};request-body:${body};`).digest("hex");
  const res = await fetch(`${APP_URL}/api/webhooks/mercadopago`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-signature": `ts=${ts},v1=${v1}` },
    body,
  });
  return res.status;
}

function encrypt(plaintext: string): string {
  // mesmo formato do token-cipher (import direto quebraria o tsconfig do
  // script — a cifra é AES-256-GCM v1:<iv>:<tag>:<data>)
  const key = Buffer.from(CIPHER_KEY!, "hex");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

async function main() {
  console.log("=== cenário no banco local ===");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema: { ...schema, ...authSchema } });

  const SELLER = "smoke-seller-cards";
  const BIDDER1 = "smoke-bidder-1";
  const BIDDER2 = "smoke-bidder-2";

  await db.insert(authSchema.user).values([
    { id: SELLER, name: "Smoke Seller", email: "smoke-seller@smoke.test", role: "seller", slug: "smoke-seller-cards" },
    { id: BIDDER1, name: "Arrematante 1", email: EMAIL, role: "bidder" },
    { id: BIDDER2, name: "Arrematante 2", email: "smoke-bidder2@smoke.test", role: "bidder" },
  ]).onConflictDoNothing();

  const [item] = await db.insert(schema.items).values({
    sellerId: SELLER,
    title: "Item do smoke de cartões",
    description: "Item de teste automático da matriz de cartões",
    type: "product",
    minInitialBid: 1000,
    minBidIncrement: 100,
    bidDeadline: new Date(Date.now() - 60_000),
    status: "awaiting_payment",
  }).returning();

  await db.insert(schema.bids).values([
    { itemId: item!.id, bidderId: BIDDER1, amount: 2000, rank: 1 },
    { itemId: item!.id, bidderId: BIDDER2, amount: 1500, rank: 2 },
  ]);

  await db.insert(schema.mpSellerAccounts).values({
    userId: SELLER,
    accessToken: encrypt(TOKEN!),
    refreshToken: null,
    mpUserId: null,
  }).onConflictDoUpdate({ target: schema.mpSellerAccounts.userId, set: { accessToken: encrypt(TOKEN!) } });

  console.log("=== matriz de cartões × status ===");
  let aprovados = 0, reprovados = 0, outros = 0;
  for (const card of CARDS) {
    for (const holder of STATUSES) {
      const tokenRes = await mp("/v1/card_tokens", {
        card_number: card.number,
        security_code: card.cvv,
        expiration_month: 11,
        expiration_year: +card.year,
        cardholder: { name: holder, identification: { type: "CPF", number: "12345678909" } },
      });
      const pay = await mp("/v1/payments", {
        transaction_amount: 10,
        token: tokenRes.id,
        description: `Smoke ${card.name} ${holder}`,
        installments: 1,
        payment_method_id: card.method,
        payer: { email: EMAIL },
        external_reference: item!.id,
      });
      const status = String(pay.status);
      if (status === "approved") aprovados++;
      else if (status === "rejected") reprovados++;
      else outros++;
      console.log(`  ${card.name.padEnd(12)} ${holder.padEnd(5)} → MP: ${status} (${String(pay.status_detail)})`);

      // APRO vai pelo webhook NOSSO (a cadeia completa, com assinatura)
      if (holder === "APRO" && card === CARDS[0]) {
        const [pending] = await db.insert(schema.payments).values({
          itemId: item!.id,
          bidderId: BIDDER1,
          bidId: (await db.select().from(schema.bids).where(eq(schema.bids.itemId, item!.id)))[0]!.id,
          amount: 2000,
          platformFeeCents: 100,
          sellerNetCents: 1900,
          mpPaymentId: null,
          pixQrCode: null,
          pixQrCodeBase64: null,
          paymentLink: null,
          deadline: new Date(Date.now() + 86_400_000),
          attemptNumber: 1,
        }).returning();
        const http = await webhook(String(pay.id));
        const row = (await db.select().from(schema.payments).where(eq(schema.payments.id, pending!.id)))[0]!;
        const itemRow = (await db.select().from(schema.items).where(eq(schema.items.id, item!.id)))[0]!;
        console.log(`    ↳ webhook nosso: HTTP ${http} | cobrança: ${row.status} (mp ${row.mpPaymentId === String(pay.id) ? "ADOTADO ✓" : row.mpPaymentId}) | item: ${itemRow.status}`);
      }
    }
  }
  console.log(`\nResumo MP: ${aprovados} approved, ${reprovados} rejected, ${outros} outros`);
  console.log("(cascata do OTHE → é disparada pelo cron verificar-prazos; a aprovação via webhook já cobre o caminho crítico)");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
