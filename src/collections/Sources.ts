import type { CollectionConfig } from 'payload'

/**
 * Runtime state for each entry in config/sources.yaml (the FACT-167 registry).
 * The yaml file stays the editorial source of truth (terms/attribution/status);
 * this collection is what the poller actually reads/writes (enabled flag, ETag,
 * error log) so an admin can kill a misbehaving source without touching config.
 */
export const Sources: CollectionConfig = {
  slug: 'sources',
  admin: {
    useAsTitle: 'name',
    defaultColumns: [
      'name',
      'registry_status',
      'enabled',
      'last_polled_at',
      'last_http_status',
      'last_fetched',
      'last_stored',
      'items_24h',
      'items_7d',
      'consecutive_errors',
    ],
  },
  access: {
    read: ({ req }) => !!req.user,
    create: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'source_key', type: 'text', required: true, unique: true, admin: { readOnly: true, description: 'Matches `id` in config/sources.yaml.' } },
    { name: 'name', type: 'text', required: true },
    { name: 'type', type: 'select', options: ['rss', 'api', 'press'], required: true },
    {
      name: 'registry_status',
      type: 'select',
      options: ['verified', 'candidate'],
      required: true,
      admin: { description: 'From the registry: verified = autopoll-eligible, candidate = needs manual confirmation.' },
    },
    { name: 'url', type: 'text', required: true },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Admin kill switch. A verified+enabled source is polled; a candidate still needs INGEST_INCLUDE_CANDIDATES=true as well.' },
    },
    { name: 'poll_interval', type: 'text', admin: { readOnly: true } },
    { name: 'etag', type: 'text', admin: { readOnly: true, hidden: true } },
    { name: 'last_modified', type: 'text', admin: { readOnly: true, hidden: true } },
    { name: 'last_polled_at', type: 'date', admin: { readOnly: true } },
    { name: 'last_success_at', type: 'date', admin: { readOnly: true } },
    { name: 'last_error', type: 'text', admin: { readOnly: true } },
    { name: 'consecutive_errors', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    {
      name: 'last_http_status',
      type: 'number',
      admin: { readOnly: true, description: 'HTTP status of the last poll attempt (absent when the attempt never got a response, e.g. a timeout).' },
    },
    { name: 'last_fetched', type: 'number', defaultValue: 0, admin: { readOnly: true, description: 'Items the last poll returned, before dedup.' } },
    { name: 'last_stored', type: 'number', defaultValue: 0, admin: { readOnly: true, description: 'New source_items the last poll actually stored, after dedup.' } },
    { name: 'items_24h', type: 'number', defaultValue: 0, admin: { readOnly: true, description: 'source_items stored for this source in the last 24h.' } },
    { name: 'items_7d', type: 'number', defaultValue: 0, admin: { readOnly: true, description: 'source_items stored for this source in the last 7 days.' } },
  ],
}
