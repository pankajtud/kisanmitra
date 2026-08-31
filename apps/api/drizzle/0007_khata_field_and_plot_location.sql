ALTER TABLE "fields" ADD COLUMN "latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "fields" ADD COLUMN "longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "fields" ADD COLUMN "location_accuracy_m" integer;--> statement-breakpoint
ALTER TABLE "khatas" ADD COLUMN "field_id" uuid;--> statement-breakpoint
ALTER TABLE "khatas" ADD CONSTRAINT "khatas_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;