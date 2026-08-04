CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"password_hash" text,
	"platform_role" text DEFAULT 'user' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_platform_operator" text DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kb_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"kb_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'read' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "kb_members_kb_user_uidx" ON "kb_members" USING btree ("kb_id","user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ask_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"kb_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"status" text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ask_traces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"kb_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"request_id" text NOT NULL,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"min_support" real,
	"latency_ms" integer,
	"mode" text,
	"raw_question" text NOT NULL,
	"standalone_question" text,
	"rewrite_used" integer DEFAULT 0 NOT NULL,
	"session_deepened" integer DEFAULT 0 NOT NULL,
	"answer" text,
	"config_snap" jsonb,
	"graph_trace" jsonb,
	"evidence_snapshot" jsonb DEFAULT '[]'::jsonb,
	"langfuse_trace_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ask_feedback" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"kb_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"rating" text,
	"category" text,
	"comment" text,
	"status" text DEFAULT 'open' NOT NULL,
	"handler_id" uuid,
	"resolved_at" text
);
