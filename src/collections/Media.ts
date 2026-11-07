import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { useAsTitle: 'alt' },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  upload: {
    staticDir: 'media',
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300 },
      { name: 'card', width: 800, height: 450 },
    ],
    mimeTypes: ['image/*'],
  },
  fields: [
    { name: 'alt', type: 'text', required: true, admin: { description: 'Required for accessibility and SEO.' } },
    { name: 'credit', type: 'text' },
    { name: 'author', type: 'text' },
    { name: 'license', type: 'text' },
    { name: 'license_url', type: 'text' },
    { name: 'source_url', type: 'text' },
    {
      name: 'ai_generated',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Must be true for any AI-generated illustration. Never used for real people/events.' },
    },
  ],
}
