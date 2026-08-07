CREATE TABLE IF NOT EXISTS "departments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"code" text,
	"path" text DEFAULT '/' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "departments_tenant_code_uidx" ON "departments" USING btree ("tenant_id","code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_departments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"dept_id" uuid NOT NULL,
	"is_primary" integer DEFAULT 0 NOT NULL,
	"is_leader" integer DEFAULT 0 NOT NULL,
	"title" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_departments_user_dept_uidx" ON "user_departments" USING btree ("user_id","dept_id");
