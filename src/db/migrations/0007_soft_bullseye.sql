ALTER TABLE "daily_activity" ADD COLUMN "question_id" uuid;--> statement-breakpoint
ALTER TABLE "daily_activity" ADD COLUMN "is_correct" boolean DEFAULT false NOT NULL;