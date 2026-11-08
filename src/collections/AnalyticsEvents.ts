import type { CollectionConfig } from 'payload'

/**
 * Anonymous create is intentional — this is where logged-out reader beacons
 * land (scroll depth, next-article clicks). It is still safe against the
 * FACT-204 "anonymous write" concern: the only writable fields are `article`
 * (a relationship Payload validates against a real id) and `kind` (a closed
 * enum) — there is no free-text/arbitrary-payload field to abuse, and reads
 * stay admin-only.
 */
export const AnalyticsEvents: CollectionConfig = {
  slug: 'analytics_events',
  admin: { useAsTitle: 'kind', hidden: true },
  access: {
    read: ({ req }) => req.user?.role === 'admin',
    create: () => true,
    update: () => false,
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'article', type: 'relationship', relationTo: 'articles', required: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'scroll_25', value: 'scroll_25' },
        { label: 'scroll_50', value: 'scroll_50' },
        { label: 'scroll_75', value: 'scroll_75' },
        { label: 'scroll_100', value: 'scroll_100' },
        { label: 'next_article_click', value: 'next_article_click' },
      ],
    },
  ],
}
