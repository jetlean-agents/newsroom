import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** FACT-340: «Терміново» — editor-only flag + 2h default expiry (see src/collections/Articles.ts). */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "breaking" boolean DEFAULT false;
  ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "breaking_until" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP COLUMN IF EXISTS "breaking";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "breaking_until";`)
}
