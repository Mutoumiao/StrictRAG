ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "owner_dept_id" uuid;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "visibility_level" integer DEFAULT 20 NOT NULL;
