import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_sensitive_categories" AS ENUM('war_safety', 'politics', 'medicine', 'accusations', 'deaths_disasters');
  CREATE TABLE IF NOT EXISTS "articles_sensitive_categories" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" "enum_articles_sensitive_categories"
  );

  ALTER TABLE "articles" ADD COLUMN "sensitive" boolean DEFAULT false;
  ALTER TABLE "articles" ADD COLUMN "ai_cost_usd" numeric;
  DO $$ BEGIN
   ALTER TABLE "articles_sensitive_categories" ADD CONSTRAINT "articles_sensitive_categories_parent_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;

  CREATE INDEX IF NOT EXISTS "articles_sensitive_categories_order_idx" ON "articles_sensitive_categories" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "articles_sensitive_categories_parent_idx" ON "articles_sensitive_categories" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "articles_sensitive_categories" CASCADE;
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "sensitive";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "ai_cost_usd";
  DROP TYPE "public"."enum_articles_sensitive_categories";`)
}
