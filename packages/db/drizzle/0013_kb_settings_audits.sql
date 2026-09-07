CREATE TABLE IF NOT EXISTS "kb_settings_audits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"kb_id" uuid NOT NULL,
	"actor_user_id" varchar(64) NOT NULL,
	"diff_json" jsonb NOT NULL
);
