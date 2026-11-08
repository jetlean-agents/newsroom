import type { CollectionConfig } from 'payload'

/**
 * One row per polled feed item. We only ever store what the registry's
 * reuse_terms allow re-publishing: title/summary/link/dates — never full
 * article bodies from protected sources (FACT-169 scope item 2).
 */
export const SourceItems: CollectionConfig = {
  slug: 'source-items',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'source', 'published_at', 'cluster_status', 'event'],
  },
  access: {
    read: ({ req }) => !!req.user,
    // The ingestion worker writes items through the Local API (overrideAccess,
    // see src/jobs/ingest/pollSource.ts), which bypasses this check entirely.
    // Over REST only admin/editor may create or update — an anonymous or
    // author-role POST/PATCH must get 401/403 (FACT-204).
    create: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    update: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'source', type: 'relationship', relationTo: 'sources', required: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'url', type: 'text', required: true },
    { name: 'canonical_url', type: 'text', required: true },
    { name: 'summary', type: 'textarea' },
    { name: 'published_at', type: 'date' },
    { name: 'fetched_at', type: 'date', required: true },
    { name: 'hash', type: 'text', required: true, unique: true, admin: { description: 'sha1(source_key::canonical_url) — identity for exact re-fetch dedup.' } },
    { name: 'title_hash', type: 'text', required: true, index: true },
    { name: 'simhash', type: 'text', required: true, admin: { description: '64-bit simhash of the normalized title, stored as decimal string.' } },
    {
      name: 'cluster_status',
      type: 'select',
      defaultValue: 'unclustered',
      options: ['unclustered', 'clustered'],
      required: true,
      index: true,
    },
    { name: 'event', type: 'relationship', relationTo: 'events' },
  ],
}
