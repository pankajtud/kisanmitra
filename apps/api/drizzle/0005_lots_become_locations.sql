ALTER TABLE "lots" DROP CONSTRAINT "lots_crop_cycle_id_crop_cycles_id_fk";
--> statement-breakpoint
ALTER TABLE "lots" DROP CONSTRAINT "lots_cold_store_id_cold_stores_id_fk";
--> statement-breakpoint
ALTER TABLE "lots" DROP CONSTRAINT "lots_crop_id_crops_id_fk";
--> statement-breakpoint
ALTER TABLE "lots" DROP CONSTRAINT "lots_field_id_fields_id_fk";
--> statement-breakpoint
ALTER TABLE "lots" DROP COLUMN "crop_cycle_id";--> statement-breakpoint
ALTER TABLE "lots" DROP COLUMN "cold_store_id";--> statement-breakpoint
ALTER TABLE "lots" DROP COLUMN "crop_id";--> statement-breakpoint
ALTER TABLE "lots" DROP COLUMN "stored_on";--> statement-breakpoint
ALTER TABLE "lots" DROP COLUMN "variety";--> statement-breakpoint
ALTER TABLE "lots" DROP COLUMN "field_id";