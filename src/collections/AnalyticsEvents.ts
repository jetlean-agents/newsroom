import type { CollectionConfig } from 'payload'

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
