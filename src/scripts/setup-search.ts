import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  const sql = readFileSync(path.join(dirname, '../sql/001_search.sql'), 'utf-8')
  await client.query(sql)
  await client.end()
  console.log('Search vector column + unaccent extension ready.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
