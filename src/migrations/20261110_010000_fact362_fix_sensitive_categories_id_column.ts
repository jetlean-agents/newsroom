import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * FACT-362: FACT-337's migration created "articles_sensitive_categories"
 * using the array/block column convention (an "id" varchar PRIMARY KEY NOT
 * NULL column, no default) — but "sensitive_categories" is a top-level
 * `select` field with `hasMany: true`, not an array/block field. For a
 * select-hasMany *sub-table*, Payload's own schema builder
 * (@payloadcms/drizzle postgres/schema/setColumnID.js, the same code that
 * decides every child table's `id` column) falls through to its default
 * case — `id serial PRIMARY KEY`, an auto-incrementing integer — because
 * nothing in this table's field list is itself named `id` and this adapter's
 * `idType` isn't `uuid`. Confirmed two ways locally against the dev DB
 * (`postgres://dev:dev@100.94.103.26:5432/newsroom`): dropping the bogus
 * varchar `id` outright makes Payload's *compiled* Drizzle schema (which
 * still expects an `id` column, serial, regardless of the live DB) throw
 * "column \"id\" of relation ... does not exist"; replacing it with a
 * `serial PRIMARY KEY` lets a real `draftFromEvent()` tick create a
 * `sensitive: true` article with no error at all.
 *
 * Before this fix, every insert of a non-empty `sensitive_categories` (i.e.
 * every article flagged `sensitive`) failed with "null value in column
 * \"id\" ... violates not-null constraint", uncaught, inside
 * `draftFromEvent()`'s `payload.create()` call — the real cause behind
 * "events→draft funnel stuck, 0 autopublications, job failing every tick"
 * once a sensitive-topic event reached the front of the queue. FACT-355
 * already fixed this table's `order`/`parent_id` column *names* but didn't
 * touch this `id` column's type/default.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'articles_sensitive_categories' AND column_name = 'id' AND data_type <> 'integer'
    ) THEN
      ALTER TABLE "articles_sensitive_categories" DROP CONSTRAINT IF EXISTS "articles_sensitive_categories_pkey";
      ALTER TABLE "articles_sensitive_categories" DROP COLUMN "id";
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'articles_sensitive_categories' AND column_name = 'id'
    ) THEN
      ALTER TABLE "articles_sensitive_categories" ADD COLUMN "id" serial PRIMARY KEY;
    END IF;
   END $$;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'articles_sensitive_categories' AND column_name = 'id' AND data_type = 'integer'
    ) THEN
      ALTER TABLE "articles_sensitive_categories" DROP CONSTRAINT IF EXISTS "articles_sensitive_categories_pkey";
      ALTER TABLE "articles_sensitive_categories" DROP COLUMN "id";
      ALTER TABLE "articles_sensitive_categories" ADD COLUMN "id" varchar PRIMARY KEY NOT NULL DEFAULT substr(md5(random()::text), 1, 24);
      ALTER TABLE "articles_sensitive_categories" ALTER COLUMN "id" DROP DEFAULT;
    END IF;
   END $$;`)
}
