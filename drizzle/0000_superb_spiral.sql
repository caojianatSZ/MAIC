CREATE TABLE "classroom_conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_classroom_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_classroom_phone" UNIQUE("organization_classroom_id","phone")
);
--> statement-breakpoint
CREATE TABLE "classroom_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_classroom_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"completed" boolean DEFAULT false,
	"duration_seconds" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_classroom_session" UNIQUE("organization_classroom_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "cloned_voices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voice_id" text NOT NULL,
	"voice_name" text NOT NULL,
	"file_id" text,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "cloned_voices_voice_id_unique" UNIQUE("voice_id")
);
--> statement-breakpoint
CREATE TABLE "organization_classrooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"classroom_id" text NOT NULL,
	"share_token" text NOT NULL,
	"subject" text,
	"grade" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "organization_classrooms_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"logo_data" text,
	"logo_mime_type" text,
	"phone" text,
	"wechat_qr_url" text,
	"primary_color" text,
	"secondary_color" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "classroom_conversions" ADD CONSTRAINT "classroom_conversions_organization_classroom_id_organization_classrooms_id_fk" FOREIGN KEY ("organization_classroom_id") REFERENCES "public"."organization_classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_views" ADD CONSTRAINT "classroom_views_organization_classroom_id_organization_classrooms_id_fk" FOREIGN KEY ("organization_classroom_id") REFERENCES "public"."organization_classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_classrooms" ADD CONSTRAINT "organization_classrooms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_classroom_conversions_org_class" ON "classroom_conversions" USING btree ("organization_classroom_id");--> statement-breakpoint
CREATE INDEX "idx_classroom_views_org_class" ON "classroom_views" USING btree ("organization_classroom_id");--> statement-breakpoint
CREATE INDEX "idx_cloned_voices_created_at" ON "cloned_voices" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_organization_classrooms_org" ON "organization_classrooms" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_organization_classrooms_token" ON "organization_classrooms" USING btree ("share_token");