CREATE TABLE IF NOT EXISTS "platform_roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_system" integer DEFAULT 0 NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"codes_json" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_roles_tenant_code_uidx" ON "platform_roles" USING btree ("tenant_id","code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_user_role_uidx" ON "user_roles" USING btree ("user_id","role_id");
