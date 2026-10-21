-- Migration: MP → PagBank
-- Substitui a tabela de contas de vendedor MP por PagBank (renomeação + campo)
DROP TABLE IF EXISTS "mp_seller_accounts";--> statement-breakpoint
CREATE TABLE "pagbank_seller_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"account_id" text,
	"token_expires_at" timestamp with time zone,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pagbank_seller_accounts_user_id_unique" UNIQUE("user_id")
);--> statement-breakpoint
ALTER TABLE "pagbank_seller_accounts" ADD CONSTRAINT "pagbank_seller_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
