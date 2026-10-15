ALTER TABLE "bookmarks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reviews" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "bookmarks" CASCADE;--> statement-breakpoint
DROP TABLE "reviews" CASCADE;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "modules_status_subject_idx" ON "modules" USING btree ("status","subject");--> statement-breakpoint
CREATE INDEX "questions_status_category_idx" ON "questions" USING btree ("status","category");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_pending_ref_unique" ON "submissions" USING btree ("type","ref_id") WHERE "submissions"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "users_season_points_idx" ON "users" USING btree ("season_points" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_index_non_negative" CHECK ("users"."avatar_index" IS NULL OR "users"."avatar_index" >= 0);--> statement-breakpoint
-- Hand-written, because Drizzle does not model triggers. `updated_at` is stamped
-- by the database so it stays truthful even for writes that forget to set it.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER modules_set_updated_at BEFORE UPDATE ON "modules" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER questions_set_updated_at BEFORE UPDATE ON "questions" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER submissions_set_updated_at BEFORE UPDATE ON "submissions" FOR EACH ROW EXECUTE FUNCTION set_updated_at();