import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_fact_flags_kind" AS ENUM('number', 'date', 'name');
  CREATE TABLE IF NOT EXISTS "articles_fact_flags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL,
  	"kind" "enum_articles_fact_flags_kind" NOT NULL
  );
  
  ALTER TABLE "articles" ADD COLUMN "drafted_at" timestamp(3) with time zone;
  ALTER TABLE "articles" ADD COLUMN "originality_overlap" numeric;
  ALTER TABLE "articles" ADD COLUMN "originality_blocked" boolean DEFAULT false;
  DO $$ BEGIN
   ALTER TABLE "articles_fact_flags" ADD CONSTRAINT "articles_fact_flags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "articles_fact_flags_order_idx" ON "articles_fact_flags" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "articles_fact_flags_parent_id_idx" ON "articles_fact_flags" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "articles_fact_flags" CASCADE;
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "drafted_at";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "originality_overlap";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "originality_blocked";
  DROP TYPE "public"."enum_articles_fact_flags_kind";`)
}
