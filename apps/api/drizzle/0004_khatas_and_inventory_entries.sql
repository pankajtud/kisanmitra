CREATE TABLE "inventory_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"crop_cycle_id" uuid,
	"khata_id" uuid,
	"crop_id" uuid,
	"cold_store_id" uuid,
	"stored_on" date NOT NULL,
	"variety" text,
	"field_id" uuid,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "khata_partners" (
	"id" uuid PRIMARY KEY NOT NULL,
	"khata_id" uuid NOT NULL,
	"name" text NOT NULL,
	"share_percent" numeric(5, 2) NOT NULL,
	"is_self" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "khatas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"crop_cycle_id" uuid,
	"crop_id" uuid,
	"name" text NOT NULL,
	"opened_on" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"settled_on" date,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "khata_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "sharing_mode" text DEFAULT 'khata' NOT NULL;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "entry_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "khata_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "sharing_mode" text DEFAULT 'khata' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_entries" ADD CONSTRAINT "inventory_entries_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_entries" ADD CONSTRAINT "inventory_entries_crop_cycle_id_crop_cycles_id_fk" FOREIGN KEY ("crop_cycle_id") REFERENCES "public"."crop_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_entries" ADD CONSTRAINT "inventory_entries_khata_id_khatas_id_fk" FOREIGN KEY ("khata_id") REFERENCES "public"."khatas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_entries" ADD CONSTRAINT "inventory_entries_crop_id_crops_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_entries" ADD CONSTRAINT "inventory_entries_cold_store_id_cold_stores_id_fk" FOREIGN KEY ("cold_store_id") REFERENCES "public"."cold_stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_entries" ADD CONSTRAINT "inventory_entries_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_entries" ADD CONSTRAINT "inventory_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "khata_partners" ADD CONSTRAINT "khata_partners_khata_id_khatas_id_fk" FOREIGN KEY ("khata_id") REFERENCES "public"."khatas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "khatas" ADD CONSTRAINT "khatas_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "khatas" ADD CONSTRAINT "khatas_crop_cycle_id_crop_cycles_id_fk" FOREIGN KEY ("crop_cycle_id") REFERENCES "public"."crop_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "khatas" ADD CONSTRAINT "khatas_crop_id_crops_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "khatas" ADD CONSTRAINT "khatas_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_khata_id_khatas_id_fk" FOREIGN KEY ("khata_id") REFERENCES "public"."khatas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_entry_id_inventory_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."inventory_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_khata_id_khatas_id_fk" FOREIGN KEY ("khata_id") REFERENCES "public"."khatas"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Backfill. Every existing lot was a whole consignment in its own right, so
-- each becomes one inventory entry carrying the columns that moved up, and the
-- lot keeps only its number and location. Written by hand because a generated
-- diff would have dropped those columns and taken the data with them
-- (CLAUDE.md §2.7 — never lose a record).
INSERT INTO "inventory_entries" (
  "id", "household_id", "crop_cycle_id", "khata_id", "crop_id", "cold_store_id",
  "stored_on", "variety", "field_id", "notes", "created_by", "created_at",
  "updated_at", "deleted_at"
)
SELECT
  gen_random_uuid(), l."household_id", l."crop_cycle_id", NULL, l."crop_id",
  l."cold_store_id", l."stored_on", l."variety", l."field_id", NULL,
  l."created_by", l."created_at", l."updated_at", l."deleted_at"
FROM "lots" l
WHERE l."entry_id" IS NULL;--> statement-breakpoint

-- Point each lot at the entry just created from it. The join is on the columns
-- that were copied across, which together identify the source row.
UPDATE "lots" l
SET "entry_id" = e."id"
FROM "inventory_entries" e
WHERE l."entry_id" IS NULL
  AND e."household_id" = l."household_id"
  AND e."created_at" = l."created_at"
  AND e."stored_on" = l."stored_on"
  AND e."crop_cycle_id" IS NOT DISTINCT FROM l."crop_cycle_id"
  AND e."cold_store_id" IS NOT DISTINCT FROM l."cold_store_id";

