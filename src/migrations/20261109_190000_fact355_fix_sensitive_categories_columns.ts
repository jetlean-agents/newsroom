import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * FACT-337's migration created "articles_sensitive_categories" using the array/block
 * column convention ("_order"/"_parent_id"), but Payload's query builder generates
 * "order"/"parent_id" for a `select` field with `hasMany: true` (see
 * @payloadcms/drizzle traverseFields.js) — every query touching Articles (home,
 * /api/articles, sitemap, feed) failed with "column ...parent_id does not exist".
 * Renaming is a no-op on a fresh install where the FACT-337 migration above already
 * created the correct names, hence the existence checks.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'articles_sensitive_categories' AND column_name = '_order'
    ) THEN
      ALTER TABLE "articles_sensitive_categories" RENAME COLUMN "_order" TO "order";
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'articles_sensitive_categories' AND column_name = '_parent_id'
    ) THEN
      ALTER TABLE "articles_sensitive_categories" RENAME COLUMN "_parent_id" TO "parent_id";
    END IF;
   END $$;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'articles_sensitive_categories' AND column_name = 'order'
    ) THEN
      ALTER TABLE "articles_sensitive_categories" RENAME COLUMN "order" TO "_order";
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'articles_sensitive_categories' AND column_name = 'parent_id'
    ) THEN
      ALTER TABLE "articles_sensitive_categories" RENAME COLUMN "parent_id" TO "_parent_id";
    END IF;
   END $$;`)
}
