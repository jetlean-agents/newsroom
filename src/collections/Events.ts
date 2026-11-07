import type { CollectionConfig } from 'payload'

/**
 * A cluster of source-items believed to be the same real-world event
 * (FACT-169 scope item 3). This is the admin-facing "events queue" and the
 * handoff point into the editorial pipeline (item 4): an event with enough
 * independent sources gets a draft Article.
 */
export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'source_count', 'independent_confirmation', 'first_seen_at'],
  },
  access: {
    read: ({ req }) => !!req.user,
    create: () => true,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'title', type: 'text', required: true, admin: { description: 'Title of the earliest source item in the cluster — a label, not copy to publish verbatim.' } },
    { name: 'first_seen_at', type: 'date', required: true },
    { name: 'last_seen_at', type: 'date', required: true },
    { name: 'source_count', type: 'number', defaultValue: 1, admin: { readOnly: true } },
    {
      name: 'independent_confirmation',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true, description: 'True once >= EVENT_CONFIRMATION_MIN_SOURCES distinct publishers reported it.' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Drafted', value: 'drafted' },
        { label: 'Dismissed', value: 'dismissed' },
      ],
      required: true,
    },
    { name: 'draft_article', type: 'relationship', relationTo: 'articles' },
  ],
}
