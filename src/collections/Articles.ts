import type { CollectionConfig, PayloadRequest } from 'payload'
import { APIError } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { stableSlug } from '../lib/slug'
import type { Tag } from '../payload-types'

/**
 * Publication state machine: draft -> in_review -> published -> unpublished.
 * Only admin/editor may move a doc INTO "published", and only from "in_review" —
 * authors can take a draft to in_review but not past it.
 *
 * Throws `APIError` (not a bare `Error`) so Payload's REST layer returns the
 * right status instead of a generic 500: 403 for a role that isn't allowed to
 * make this transition at all, 400 for a role-valid transition from the wrong
 * prior status.
 */
function assertValidTransition(req: PayloadRequest, prevStatus: string | undefined, nextStatus: string) {
  if (nextStatus === prevStatus) return
  const role = req.user?.role
  if (nextStatus === 'published') {
    if (role !== 'admin' && role !== 'editor') {
      throw new APIError('Only editor/admin can publish an article.', 403)
    }
    if (prevStatus !== 'in_review') {
      throw new APIError('An article can only be published from in_review.', 400)
    }
  }
  if (nextStatus === 'unpublished' && role !== 'admin' && role !== 'editor') {
    throw new APIError('Only editor/admin can unpublish an article.', 403)
  }
}

export const Articles: CollectionConfig = {
  slug: 'articles',
  // Payload's own auto createdAt/updatedAt would collide with our content-meaning
  // `updated_at` (only bumped on a substantive edit, not on every save).
  timestamps: false,
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'rubric', 'published_at', 'updated_at'],
    preview: (doc) => `/articles/${doc.slug}`,
  },
  access: {
    read: ({ req }) => {
      // Public (logged-out) readers only ever see published articles.
      if (req.user) return true
      return { status: { equals: 'published' } }
    },
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true, index: true, admin: { readOnly: true, description: 'Generated once from the title; stable afterwards.' } },
    { name: 'lead', type: 'textarea', required: true },
    { name: 'body', type: 'richText', editor: lexicalEditor({}), required: true },
    { name: 'rubric', type: 'relationship', relationTo: 'rubrics', required: true },
    { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true },
    {
      name: 'sources',
      type: 'array',
      label: 'Sources',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
        { name: 'publisher', type: 'text' },
        { name: 'accessed_at', type: 'date' },
      ],
    },
    { name: 'cover', type: 'upload', relationTo: 'media' },
    { name: 'event', type: 'relationship', relationTo: 'events', admin: { description: 'The ingestion event-cluster this draft was created from, if any.' } },
    { name: 'event_date', type: 'date', admin: { description: 'When the news event actually happened.' } },
    { name: 'published_at', type: 'date', admin: { readOnly: true } },
    {
      name: 'updated_at',
      type: 'date',
      admin: { readOnly: true, description: 'Only bumped on a substantive content edit, paired with an update_note.' },
    },
    { name: 'update_note', type: 'text', admin: { description: 'e.g. "Оновлено: уточнено кількість постраждалих"' } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'In review', value: 'in_review' },
        { label: 'Published', value: 'published' },
        { label: 'Unpublished', value: 'unpublished' },
      ],
    },
    { name: 'author', type: 'relationship', relationTo: 'users', required: true },
    { name: 'editor', type: 'relationship', relationTo: 'users' },
    { name: 'ai_assisted', type: 'checkbox', defaultValue: false },
    { name: 'ai_disclosure', type: 'text', admin: { condition: (data) => !!data.ai_assisted, description: 'Required when ai_assisted is checked.' } },
    {
      name: 'corrections',
      type: 'array',
      fields: [
        { name: 'date', type: 'date', required: true },
        { name: 'note', type: 'text', required: true },
      ],
    },
    { name: 'page_views', type: 'number', defaultValue: 0, admin: { readOnly: true, description: 'Used to rank "popular". Maintained by analytics + the recompute job.' } },
    {
      name: 'duplicate_warning',
      type: 'text',
      admin: { readOnly: true, description: 'Non-blocking: set when publishing if another article already covers this event.' },
    },
  ],
  hooks: {
    beforeChange: [
      ({ req, data, originalDoc }) => {
        data.slug = stableSlug(data.title, data.slug)

        const prevStatus = originalDoc?.status
        assertValidTransition(req, prevStatus, data.status)

        if (data.status === 'published' && prevStatus !== 'published') {
          data.published_at = data.published_at || new Date().toISOString()
          data.updated_at = data.updated_at || data.published_at
        }

        // Treat any field change other than status/editor bookkeeping as substantive.
        if (originalDoc) {
          const substantiveFields = ['title', 'lead', 'body', 'sources', 'event_date']
          const changed = substantiveFields.some(
            (f) => JSON.stringify(data[f]) !== JSON.stringify(originalDoc[f]),
          )
          if (changed && data.status === 'published') {
            data.updated_at = new Date().toISOString()
          }
        }

        return data
      },
      async ({ req, data, originalDoc }) => {
        // Non-blocking duplicate check: warn (never block) when publishing an
        // article whose event-cluster already has a different published article.
        if (data.status === 'published' && originalDoc?.status !== 'published' && data.event) {
          const eventId = typeof data.event === 'object' ? data.event.id : data.event
          const existing = await req.payload.find({
            collection: 'articles',
            where: {
              and: [
                { event: { equals: eventId } },
                { status: { equals: 'published' } },
                ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
              ],
            },
            limit: 1,
          })
          data.duplicate_warning = existing.docs[0]
            ? `Можливий дублікат: подію вже опубліковано у «${existing.docs[0].title}» (#${existing.docs[0].id}).`
            : null
        }
        return data
      },
    ],
    afterChange: [
      async ({ req, doc, previousDoc }) => {
        // Keep Tags.articleCount (and thus noindex) in sync.
        const toTagId = (t: number | Tag) => (typeof t === 'object' ? t.id : t)
        const prevTagIds: number[] = (previousDoc?.tags || []).map(toTagId)
        const nextTagIds: number[] = (doc.tags || []).map(toTagId)
        const added = nextTagIds.filter((id) => !prevTagIds.includes(id))
        const removed = prevTagIds.filter((id) => !nextTagIds.includes(id))

        for (const tagId of added) {
          const tag = await req.payload.findByID({ collection: 'tags', id: tagId })
          await req.payload.update({
            collection: 'tags',
            id: tagId,
            data: { articleCount: (tag.articleCount || 0) + 1 },
            disableTransaction: true,
          })
        }
        for (const tagId of removed) {
          const tag = await req.payload.findByID({ collection: 'tags', id: tagId })
          await req.payload.update({
            collection: 'tags',
            id: tagId,
            data: { articleCount: Math.max(0, (tag.articleCount || 0) - 1) },
            disableTransaction: true,
          })
        }
      },
    ],
  },
}
