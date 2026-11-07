import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { stableSlug } from '../lib/slug'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title' },
  access: {
    read: () => true,
    create: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    update: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true, index: true, admin: { readOnly: true } },
    { name: 'body', type: 'richText', editor: lexicalEditor({}) },
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
