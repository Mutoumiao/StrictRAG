CREATE TABLE IF NOT EXISTS "ingest_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"kb_id" uuid NOT NULL,
	"doc_id" uuid NOT NULL,
	"index_version" integer NOT NULL,
	"chunk_count" integer NOT NULL,
	"internal_dropped" integer NOT NULL,
	"dual_ready" integer NOT NULL,
	"embed_ready" integer NOT NULL,
	"es_ready" integer NOT NULL,
	"reconcile_ok" integer,
	"reconcile_missing" integer,
	"reconcile_orphan" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ingest_reports_doc_version_uidx" ON "ingest_reports" USING btree ("doc_id","index_version");
