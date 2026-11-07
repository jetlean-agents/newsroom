import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_sources_type" AS ENUM('rss', 'api', 'press');
  CREATE TYPE "public"."enum_sources_registry_status" AS ENUM('verified', 'candidate');
  CREATE TYPE "public"."enum_source_items_cluster_status" AS ENUM('unclustered', 'clustered');
  CREATE TYPE "public"."enum_events_status" AS ENUM('new', 'drafted', 'dismissed');
  CREATE TABLE IF NOT EXISTS "sources" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"source_key" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"type" "enum_sources_type" NOT NULL,
  	"registry_status" "enum_sources_registry_status" NOT NULL,
  	"url" varchar NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"poll_interval" varchar,
  	"etag" varchar,
  	"last_modified" varchar,
  	"last_polled_at" timestamp(3) with time zone,
  	"last_success_at" timestamp(3) with time zone,
  	"last_error" varchar,
  	"consecutive_errors" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "source_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"source_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"canonical_url" varchar NOT NULL,
  	"summary" varchar,
  	"published_at" timestamp(3) with time zone,
  	"fetched_at" timestamp(3) with time zone NOT NULL,
  	"hash" varchar NOT NULL,
  	"title_hash" varchar NOT NULL,
  	"simhash" varchar NOT NULL,
  	"cluster_status" "enum_source_items_cluster_status" DEFAULT 'unclustered' NOT NULL,
  	"event_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"first_seen_at" timestamp(3) with time zone NOT NULL,
  	"last_seen_at" timestamp(3) with time zone NOT NULL,
  	"source_count" numeric DEFAULT 1,
  	"independent_confirmation" boolean DEFAULT false,
  	"status" "enum_events_status" DEFAULT 'new' NOT NULL,
  	"draft_article_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "articles" ADD COLUMN "event_id" integer;
  ALTER TABLE "articles" ADD COLUMN "duplicate_warning" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sources_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "source_items_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "events_id" integer;
  DO $$ BEGIN
   ALTER TABLE "source_items" ADD CONSTRAINT "source_items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "source_items" ADD CONSTRAINT "source_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "events" ADD CONSTRAINT "events_draft_article_id_articles_id_fk" FOREIGN KEY ("draft_article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE UNIQUE INDEX IF NOT EXISTS "sources_source_key_idx" ON "sources" USING btree ("source_key");
  CREATE INDEX IF NOT EXISTS "sources_updated_at_idx" ON "sources" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "sources_created_at_idx" ON "sources" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "source_items_source_idx" ON "source_items" USING btree ("source_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "source_items_hash_idx" ON "source_items" USING btree ("hash");
  CREATE INDEX IF NOT EXISTS "source_items_title_hash_idx" ON "source_items" USING btree ("title_hash");
  CREATE INDEX IF NOT EXISTS "source_items_cluster_status_idx" ON "source_items" USING btree ("cluster_status");
  CREATE INDEX IF NOT EXISTS "source_items_event_idx" ON "source_items" USING btree ("event_id");
  CREATE INDEX IF NOT EXISTS "source_items_updated_at_idx" ON "source_items" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "source_items_created_at_idx" ON "source_items" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "events_draft_article_idx" ON "events" USING btree ("draft_article_id");
  CREATE INDEX IF NOT EXISTS "events_updated_at_idx" ON "events" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "events_created_at_idx" ON "events" USING btree ("created_at");
  DO $$ BEGIN
   ALTER TABLE "articles" ADD CONSTRAINT "articles_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sources_fk" FOREIGN KEY ("sources_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_source_items_fk" FOREIGN KEY ("source_items_id") REFERENCES "public"."source_items"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "articles_event_idx" ON "articles" USING btree ("event_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_sources_id_idx" ON "payload_locked_documents_rels" USING btree ("sources_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_source_items_id_idx" ON "payload_locked_documents_rels" USING btree ("source_items_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "source_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "sources" CASCADE;
  DROP TABLE "source_items" CASCADE;
  DROP TABLE "events" CASCADE;
  ALTER TABLE "articles" DROP CONSTRAINT "articles_event_id_events_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sources_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_source_items_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_events_fk";
  
  DROP INDEX IF EXISTS "articles_event_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_sources_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_source_items_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_events_id_idx";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "event_id";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "duplicate_warning";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "sources_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "source_items_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "events_id";
  DROP TYPE "public"."enum_sources_type";
  DROP TYPE "public"."enum_sources_registry_status";
  DROP TYPE "public"."enum_source_items_cluster_status";
  DROP TYPE "public"."enum_events_status";`)
}
