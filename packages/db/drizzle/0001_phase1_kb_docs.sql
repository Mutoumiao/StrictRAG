CREATE TABLE IF NOT EXISTS "knowledge_bases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"kb_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"approval_status" text DEFAULT 'none' NOT NULL,
	"lifecycle" text DEFAULT 'draft' NOT NULL,
	"source_type" text DEFAULT 'upload' NOT NULL,
	"object_bucket" text,
	"object_key" text,
	"content_type" text,
	"byte_size" integer,
	"checksum_sha256" text,
	"parsed_text" text,
	"mongo_doc_id" text,
	"extract_method" text,
	"index_version" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"uploaded_by" uuid,
	"approved_by" uuid,
	"approved_at" text,
	"doc_type" text,
	"chunk_strategy" text DEFAULT 'structure_paragraph',
	"chunk_strategy_params" jsonb,
	"embed_ready" integer DEFAULT 0 NOT NULL,
	"es_ready" integer DEFAULT 0 NOT NULL,
	"effective_from" text,
	"effective_to" text,
	"supersedes_doc_id" uuid,
	"superseded_by_doc_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chunks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"kb_id" uuid NOT NULL,
	"doc_id" uuid NOT NULL,
	"index_version" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"preview" text,
	"body_text" text,
	"context_prefix" text,
	"token_count" integer,
	"mongo_body_id" text,
	"meta" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chunk_manifests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"kb_id" uuid NOT NULL,
	"doc_id" uuid NOT NULL,
	"index_version" integer NOT NULL,
	"chunk_ids" jsonb NOT NULL,
	"frozen" integer DEFAULT 1 NOT NULL,
	"strategy" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chunk_embeddings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"kb_id" uuid NOT NULL,
	"doc_id" uuid NOT NULL,
	"chunk_id" uuid NOT NULL,
	"index_version" integer NOT NULL,
	"model" text NOT NULL,
	"dims" integer NOT NULL,
	"embedding" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingest_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"kb_id" uuid NOT NULL,
	"doc_id" uuid NOT NULL,
	"queue" text NOT NULL,
	"job_name" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"index_version" integer,
	"error_message" text,
	"payload" jsonb DEFAULT '{}'::jsonb
);
