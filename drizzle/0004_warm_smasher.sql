CREATE INDEX "bids_item_id_amount_idx" ON "bids" USING btree ("item_id","amount" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "items_seller_id_idx" ON "items" USING btree ("seller_id");