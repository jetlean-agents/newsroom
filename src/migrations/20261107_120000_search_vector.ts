import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const search = readFileSync(path.join(dirname, '../sql/001_search.sql'), 'utf-8')
  await db.execute(sql.raw(search))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TRIGGER IF EXISTS articles_search_vector_trigger ON articles;
    DROP FUNCTION IF EXISTS articles_search_vector_update();
    ALTER TABLE articles DROP COLUMN IF EXISTS search_vector;
  `)
}
