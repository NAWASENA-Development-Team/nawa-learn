-- ─── M18: paket ujian melewati peninjauan ──────────────────────────────────────
--
-- Kolomnya ditambahkan **nullable, tanpa default**, lalu diisi, baru dikunci.
-- Urutan itu bukan gaya penulisan: `ADD COLUMN ... DEFAULT 'pending' NOT NULL`
-- yang dihasilkan `drizzle-kit` akan menandai **setiap** baris lama sebagai
-- `pending`, dan satu-satunya cara membedakan baris lama dari paket yang baru
-- diajukan adalah "apakah baris ini sudah ada sebelum kolomnya ada". Tanpa
-- pemisahan itu, backfill-nya harus buta — dan backfill buta yang berjalan pada
-- database yang sudah menjalankan kode M18 akan menerbitkan paket yang belum
-- pernah ditinjau siapa pun, tepat pada hal yang M18 ada untuk mencegah.
--
-- Baris lama memang **approved**, bukan `pending`: paket itu sudah beredar dan
-- dikerjakan siswa sebelum M18, dan menandainya `pending` akan menyembunyikannya
-- dari daftar tanpa ada moderator yang memutuskan apa pun.
ALTER TABLE "custom_exams" ADD COLUMN "status" "status";--> statement-breakpoint
UPDATE "custom_exams" SET "status" = 'approved' WHERE "status" IS NULL;--> statement-breakpoint
ALTER TABLE "custom_exams" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "custom_exams" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "custom_exams_status_created_idx" ON "custom_exams" USING btree ("status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "custom_exams_author_status_idx" ON "custom_exams" USING btree ("author_id","status");
