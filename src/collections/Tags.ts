import type { CollectionConfig } from 'payload'
import { stableSlug } from '../lib/slug'
import { isTagNoindex } from '../lib/seo'

export const Tags: CollectionConfig = {
  slug: 'tags',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'articleCount', 'noindex'],
  },
  access: {
    read: () => true,
    create: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    update: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true, index: true, admin: { readOnly: true } },
    {
      name: 'articleCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Maintained by the articles afterChange hook; used to decide noindex.',
      },
    },
    {
      name: 'noindex',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        readOnly: true,
        description: 'True while articleCount is below the noindex threshold (see src/lib/seo.ts).',
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => isTagNoindex(siblingData.articleCount ?? 0),
        ],
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        data.slug = stableSlug(data.title, data.slug)
        return data
      },
    ],
  },
}
