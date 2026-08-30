CREATE TABLE "crops" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"name_hi" text NOT NULL,
	"name_en" text NOT NULL,
	"default_unit" text,
	"uses_cold_storage" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "lot_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "crop_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "product" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "quantity" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "crop_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "crop_cycle_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "crop_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "field_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "quantity" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "partner_name" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "partner_share" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "crops" ADD CONSTRAINT "crops_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_crop_id_crops_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_crop_id_crops_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_crop_cycle_id_crop_cycles_id_fk" FOREIGN KEY ("crop_cycle_id") REFERENCES "public"."crop_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_crop_id_crops_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;