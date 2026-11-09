import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "last_http_status" numeric;
  ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "last_fetched" numeric DEFAULT 0;
  ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "last_stored" numeric DEFAULT 0;
  ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "items_24h" numeric DEFAULT 0;
  ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "items_7d" numeric DEFAULT 0;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "sources" DROP COLUMN IF EXISTS "last_http_status";
  ALTER TABLE "sources" DROP COLUMN IF EXISTS "last_fetched";
  ALTER TABLE "sources" DROP COLUMN IF EXISTS "last_stored";
  ALTER TABLE "sources" DROP COLUMN IF EXISTS "items_24h";
  ALTER TABLE "sources" DROP COLUMN IF EXISTS "items_7d";`)
}
