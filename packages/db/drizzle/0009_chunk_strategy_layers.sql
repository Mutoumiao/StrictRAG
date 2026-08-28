CREATE TABLE IF NOT EXISTS "chunk_strategy_definitions" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"doc_families" jsonb NOT NULL,
	"param_schema" jsonb NOT NULL,
	"pipeline_id" text NOT NULL,
	"implemented" boolean DEFAULT false NOT NULL,
	"system" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(0),
	"updated_at" timestamp(0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kb_chunk_strategies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"kb_id" uuid NOT NULL,
	"code" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"param_overrides" jsonb,
	"recommended_families" jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "kb_chunk_strategies_kb_code_uidx" ON "kb_chunk_strategies" USING btree ("kb_id","code");
--> statement-breakpoint
INSERT INTO "chunk_strategy_definitions" ("code","name","doc_families","param_schema","pipeline_id","implemented","system")
VALUES
	('structure_paragraph','结构段落','["md","txt","docx","pdf_text"]'::jsonb,'{"chunkTokens":256,"chunkOverlap":32,"contextMode":"l1_llm"}'::jsonb,'ingest-chunk',true,true),
	('fixed_window','固定窗口','["md","txt","docx","pdf_text"]'::jsonb,'{"chunkTokens":256,"chunkOverlap":32,"contextMode":"l1_llm"}'::jsonb,'ingest-chunk',false,true),
	('heading_sections','标题分节','["md"]'::jsonb,'{"chunkTokens":256,"chunkOverlap":32,"contextMode":"l1_llm"}'::jsonb,'ingest-chunk',false,true)
ON CONFLICT ("code") DO NOTHING;
