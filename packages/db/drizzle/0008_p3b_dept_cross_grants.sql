CREATE TABLE IF NOT EXISTS "dept_cross_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"user_id" uuid NOT NULL,
	"dept_id" uuid NOT NULL,
	"max_visibility_level" integer NOT NULL,
	"expires_at" timestamp(0),
	"reason" text,
	"granted_by" uuid
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dept_cross_grants_user_dept_uidx" ON "dept_cross_grants" USING btree ("user_id","dept_id");
