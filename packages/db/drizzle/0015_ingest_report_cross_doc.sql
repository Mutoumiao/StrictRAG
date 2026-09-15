ALTER TABLE "ingest_reports" ADD COLUMN IF NOT EXISTS "cross_doc_dropped" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ingest_reports" ADD COLUMN IF NOT EXISTS "conflict_pairs" jsonb DEFAULT '[]'::jsonb NOT NULL;
