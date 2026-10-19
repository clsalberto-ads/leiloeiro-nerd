ALTER TYPE "public"."notification_type" ADD VALUE 'next_bidder_called';--> statement-breakpoint
CREATE TABLE "mp_seller_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"mp_user_id" text,
	"token_expires_at" timestamp with time zone,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mp_seller_accounts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "cascade_deadline_days" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "platform_fee_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "seller_net_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mp_seller_accounts" ADD CONSTRAINT "mp_seller_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;