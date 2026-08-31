ALTER TABLE "sale_grades" ADD COLUMN "household_id" uuid;--> statement-breakpoint
ALTER TABLE "sale_grades" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_grades" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sale_grades" ADD CONSTRAINT "sale_grades_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;