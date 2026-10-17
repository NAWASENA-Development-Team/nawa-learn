ALTER TABLE "users" ADD COLUMN "consent_policy_version" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "consent_accepted_at" timestamp;