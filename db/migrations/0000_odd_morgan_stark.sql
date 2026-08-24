CREATE TYPE "public"."channel" AS ENUM('whatsapp', 'phone', 'in_store');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('out', 'in');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('he', 'ru', 'en');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('walkout', 'phone_tradein', 'phone_website', 'walkin', 'other');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('nudge', 'awaiting_photos', 'photos_in', 'schedule_meeting', 'get_back_later', 'poopy');--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"direction" "direction" NOT NULL,
	"channel" "channel" DEFAULT 'whatsapp' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"phone_raw" text NOT NULL,
	"stage" "stage" DEFAULT 'nudge' NOT NULL,
	"source" "source" DEFAULT 'walkout' NOT NULL,
	"language" "language" DEFAULT 'he' NOT NULL,
	"interest" text DEFAULT '' NOT NULL,
	"quoted_price" integer,
	"objection" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"next_touch_at" date,
	"last_contact_at" timestamp with time zone,
	"touch_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"cadence" jsonb NOT NULL,
	"quiet_hours" jsonb NOT NULL,
	"knowledge_base" text DEFAULT '' NOT NULL,
	"ui_direction" text DEFAULT 'ltr' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage" "stage" NOT NULL,
	"language" "language" NOT NULL,
	"touch_number" integer NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "templates_slot_idx" ON "templates" USING btree ("stage","language","touch_number");