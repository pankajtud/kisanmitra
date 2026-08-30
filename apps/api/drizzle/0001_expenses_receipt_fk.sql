-- expenses.receipt_id is added as a separate, forward-only migration so the
-- expense/receipt dependency edge can be introduced independently of the
-- table creation (CLAUDE.md §6).
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE no action ON UPDATE no action;
