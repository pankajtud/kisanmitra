ALTER TABLE "cold_stores" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cold_stores" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cold_stores" ADD COLUMN "archived_at" timestamp with time zone;