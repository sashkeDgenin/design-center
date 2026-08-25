ALTER TABLE "leads" ADD COLUMN "remind_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "reminded_at" timestamp with time zone;