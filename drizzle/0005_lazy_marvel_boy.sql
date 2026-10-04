CREATE TABLE "user_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "search_tsv" text GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(description, ''))) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_favorites_user_id_item_id_idx" ON "user_favorites" USING btree ("user_id","item_id");--> statement-breakpoint
CREATE INDEX "items_search_tsv_idx" ON "items" USING gin (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(description, '')));