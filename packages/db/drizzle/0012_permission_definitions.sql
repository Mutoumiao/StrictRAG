CREATE TABLE IF NOT EXISTS "permission_definitions" (
	"code" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"scope" text NOT NULL,
	"description" text NOT NULL,
	"source" text NOT NULL
);
