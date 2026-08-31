CREATE TABLE "changes" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"device_id" text,
	"updated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "overwrites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"losing_payload" jsonb NOT NULL,
	"losing_updated_at" timestamp with time zone NOT NULL,
	"winning_updated_at" timestamp with time zone NOT NULL,
	"loser" text NOT NULL,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "invite_code" text;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "khata_partners" ADD COLUMN "household_id" uuid;--> statement-breakpoint
ALTER TABLE "khata_partners" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "khata_partners" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lot_grades" ADD COLUMN "household_id" uuid;--> statement-breakpoint
ALTER TABLE "lot_grades" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "lot_grades" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "changes" ADD CONSTRAINT "changes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overwrites" ADD CONSTRAINT "overwrites_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "changes_household_seq_idx" ON "changes" USING btree ("household_id","seq");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "otp_codes" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "khata_partners" ADD CONSTRAINT "khata_partners_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_grades" ADD CONSTRAINT "lot_grades_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;