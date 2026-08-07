CREATE TABLE IF NOT EXISTS "model_providers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"preset_key" text NOT NULL,
	"base_url" text NOT NULL,
	"api_key_enc" text,
	"timeout_ms" integer DEFAULT 60000 NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"models_json" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "model_bindings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"scope_id" text DEFAULT '' NOT NULL,
	"purpose" text NOT NULL,
	"primary_ref" text NOT NULL,
	"fallback_refs" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "model_bindings_scope_purpose_uidx" ON "model_bindings" USING btree ("tenant_id","scope","scope_id","purpose");
