CREATE INDEX "custom_exams_created_idx" ON "custom_exams" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "modules_uploader_idx" ON "modules" USING btree ("uploader_id");--> statement-breakpoint
CREATE INDEX "questions_status_created_idx" ON "questions" USING btree ("status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "questions_uploader_idx" ON "questions" USING btree ("uploader_id");--> statement-breakpoint
CREATE INDEX "reports_user_created_idx" ON "reports" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "submissions_submitter_created_idx" ON "submissions" USING btree ("submitter_id","submitted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "users_points_idx" ON "users" USING btree ("points" DESC NULLS LAST);