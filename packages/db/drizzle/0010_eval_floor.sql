CREATE TABLE IF NOT EXISTS "gold_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"kb_id" uuid NOT NULL,
	"case_key" text NOT NULL,
	"question" text NOT NULL,
	"type" text NOT NULL,
	"expected_doc_ids" jsonb,
	"expected_chunk_ids" jsonb,
	"rubric" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gold_questions_kb_case_uidx" ON "gold_questions" USING btree ("kb_id","case_key");
--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'succeeded' NOT NULL;
--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN IF NOT EXISTS "job_id" text;
--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN IF NOT EXISTS "error_message" text;
