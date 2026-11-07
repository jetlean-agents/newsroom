import path from 'path'
import { fileURLToPath } from 'url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Rubrics } from './collections/Rubrics'
import { Tags } from './collections/Tags'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Articles } from './collections/Articles'
import { AnalyticsEvents } from './collections/AnalyticsEvents'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  editor: lexicalEditor({}),
  collections: [Users, Rubrics, Tags, Media, Pages, Articles, AnalyticsEvents],
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
    // push is explicitly off: it diffs/rewrites tables on every init, which fights
    // the hand-written search_vector column/trigger from src/sql/001_search.sql.
    // Schema changes go through `payload migrate` (see src/migrations) instead.
    push: false,
  }),
})
