import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_content_type" AS ENUM('news', 'evergreen');
  ALTER TABLE "articles" ADD COLUMN "content_type" "enum_articles_content_type" DEFAULT 'news' NOT NULL;
  ALTER TABLE "articles" ADD COLUMN "featured" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP COLUMN IF EXISTS "content_type";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "featured";
  DROP TYPE "public"."enum_articles_content_type";`)
}
