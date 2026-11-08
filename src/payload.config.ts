import path from 'path'
import { fileURLToPath } from 'url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Rubrics } from './collections/Rubrics'
import { Tags } from './collections/Tags'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Articles } from './collections/Articles'
import { AnalyticsEvents } from './collections/AnalyticsEvents'
import { Sources } from './collections/Sources'
import { SourceItems } from './collections/SourceItems'
import { Events } from './collections/Events'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  editor: lexicalEditor({}),
  collections: [Users, Rubrics, Tags, Media, Pages, Articles, AnalyticsEvents, Sources, SourceItems, Events],
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  sharp,
  // Media files live in S3-compatible storage (MinIO on stage, R2 on prod), never on the
  // container's local disk — see docs/env.md S3_* vars. Disabled only when S3_BUCKET is unset
  // (e.g. a throwaway local run), falling back to Payload's local-disk upload handler.
  plugins: process.env.S3_BUCKET
    ? [
        s3Storage({
          collections: {
            media: {
              disableLocalStorage: true,
              generateFileURL: ({ filename }) => `${process.env.S3_PUBLIC_URL}/${filename}`,
            },
          },
          bucket: process.env.S3_BUCKET,
          acl: 'public-read',
          config: {
            endpoint: process.env.S3_ENDPOINT,
            region: process.env.S3_REGION || 'auto',
            credentials: {
              accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
            },
            forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
          },
        }),
      ]
    : [],
  // This sandbox host blocks/stalls outbound egress to telemetry.payloadcms.com,
  // and Payload's telemetry fetch has no timeout, so every CLI command (migrate,
  // seed) hangs indefinitely unless telemetry is disabled outright.
  telemetry: false,
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
