CREATE TABLE IF NOT EXISTS "schema_meta" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"key" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "schema_meta_key_unique" UNIQUE("key")
);
