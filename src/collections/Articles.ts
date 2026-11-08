import type { CollectionConfig, PayloadRequest } from 'payload'
import { APIError } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { stableSlug } from '../lib/slug'
import { plainTextFromBody } from '../lib/richText'
import { maxOverlap } from '../lib/ai/originality'
import { factCheckFlags } from '../lib/ai/factCheck'
import { ORIGINALITY_MAX_OVERLAP } from '../lib/env'
import { SYSTEM_AUTHOR_EMAIL } from '../lib/ingest/systemAuthor'
import type { Article, Tag, SourceItem } from '../payload-types'

function idOf(value: unknown): number | undefined {
  if (value == null) return undefined
  return typeof value === 'object' ? (value as { id: number }).id : (value as number)
}

/**
 * Originality/fact-check fields are entirely server-owned (PO review 08.11):
 * recomputed from the event's source-items on every save of an ai_assisted
 * article, never taken from client-submitted data — a PATCH claiming
 * `originality_blocked: false` has no effect, this overwrites it before
 * assertValidTransition ever sees it. Also fixes the original "block can
 * never be lifted" bug: editing lead/title/body now re-runs the check instead
 * of freezing originality_overlap at whatever draftFromEvent() first computed.
 */
async function recomputeOriginality(
  req: PayloadRequest,
  data: Record<string, unknown>,
  originalDoc?: Record<string, unknown>,
) {
  const aiAssisted = data.ai_assisted ?? originalDoc?.ai_assisted
  if (!aiAssisted) {
    data.originality_overlap = null
    data.originality_blocked = false
    data.fact_flags = []
    return
  }

  const eventId = idOf(data.event ?? originalDoc?.event)
  if (!eventId) {
    // No event to recompute against (e.g. an article manually flagged
    // ai_assisted with no event) — keep whatever is already stored rather
    // than trust unverifiable client input.
    data.originality_overlap = originalDoc?.originality_overlap ?? null
    data.originality_blocked = originalDoc?.originality_blocked ?? false
    data.fact_flags = originalDoc?.fact_flags ?? []
    return
  }

  const members = await req.payload.find({
    collection: 'source-items',
    where: { event: { equals: eventId } },
    limit: 50,
  })
  const sourceTexts = members.docs.map((item: SourceItem) => `${item.title} ${item.summary ?? ''}`)

  const title = data.title ?? originalDoc?.title ?? ''
  const lead = data.lead ?? originalDoc?.lead ?? ''
  const body = (data.body ?? originalDoc?.body) as Article['body'] | undefined
  const bodyText = [title, lead, plainTextFromBody(body)].filter(Boolean).join('\n')

  const overlap = maxOverlap(bodyText, sourceTexts)
  data.originality_overlap = overlap
  data.originality_blocked = overlap > ORIGINALITY_MAX_OVERLAP
  data.fact_flags = factCheckFlags(bodyText, sourceTexts)
}

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
function assertValidTransition(
  req: PayloadRequest,
  prevStatus: string | undefined,
  nextStatus: string,
  originalityBlocked?: boolean | null,
) {
  if (nextStatus === prevStatus) return
  const role = req.user?.role
  if (nextStatus === 'published') {
    if (role !== 'admin' && role !== 'editor') {
      throw new APIError('Only editor/admin can publish an article.', 403)
    }
    if (prevStatus !== 'in_review') {
      throw new APIError('An article can only be published from in_review.', 400)
    }
    if (originalityBlocked) {
      throw new APIError(
        'Draft overlaps too much with its sources (originality_overlap over ORIGINALITY_MAX_OVERLAP) — rewrite before publishing.',
        400,
      )
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
    defaultColumns: ['title', 'status', 'rubric', 'originality_overlap', 'published_at', 'updated_at'],
    // `doc.rubric` here is often just an id, not the populated relationship — the stable
    // `/articles/{slug}` legacy path (301 → `/{rubric}/{slug}/`, see src/app/(frontend)/articles/[slug]/route.ts)
    // avoids needing a second lookup just to build the preview link.
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
      name: 'content_type',
      type: 'select',
      required: true,
      defaultValue: 'news',
      options: [
        { label: 'Новина (NewsArticle, прив’язана до події)', value: 'news' },
        { label: 'Evergreen-пояснялка (Article)', value: 'evergreen' },
      ],
      admin: { description: 'Визначає JSON-LD тип: news → NewsArticle, evergreen → Article (tech-spec.md §3).' },
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Закріплено редактором у блоці «Головне» на хабі рубрики та на головній.' },
    },
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
    {
      name: 'drafted_at',
      type: 'date',
      admin: { readOnly: true, description: 'When draftFromEvent() created this article. Used to enforce DRAFTS_PER_DAY (Articles has no createdAt — timestamps: false above).' },
    },
    { name: 'ai_assisted', type: 'checkbox', defaultValue: false },
    { name: 'ai_disclosure', type: 'text', admin: { condition: (data) => !!data.ai_assisted, description: 'Required when ai_assisted is checked.' } },
    {
      name: 'originality_overlap',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'Shingle overlap (0-1) of the draft against its most-copied-from source. Server-owned: recomputed on every save of an ai_assisted article (src/collections/Articles.ts recomputeOriginality, src/lib/ai/originality.ts) — any client-submitted value for this field is ignored.',
      },
    },
    {
      name: 'originality_blocked',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true, description: 'True when originality_overlap > ORIGINALITY_MAX_OVERLAP — blocks the draft -> published transition until rewritten. Server-owned, see originality_overlap.' },
    },
    {
      name: 'fact_flags',
      type: 'array',
      admin: { readOnly: true, description: 'Numbers/dates/names in the draft not found in any source — "перевірити" pointers for the reviewing editor, non-blocking. Server-owned, see originality_overlap.' },
      fields: [
        { name: 'value', type: 'text', required: true },
        { name: 'kind', type: 'select', required: true, options: ['number', 'date', 'name'] },
      ],
    },
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
      async ({ req, data, originalDoc }) => {
        data.slug = stableSlug(data.title, data.slug)

        await recomputeOriginality(req, data, originalDoc)

        const prevStatus = originalDoc?.status
        assertValidTransition(req, prevStatus, data.status, data.originality_blocked)

        if (data.status === 'published' && prevStatus !== 'published') {
          data.published_at = data.published_at || new Date().toISOString()
          data.updated_at = data.updated_at || data.published_at
        }

        // On the actual in_review -> published transition, record who verified
        // the material: `editor` is always the publishing user. If `author` is
        // still the ingest placeholder (an AI draft nobody has claimed yet),
        // swap it for that same real person too — a draft must never ship
        // with a system byline (AC item 7: "author = real editor who verified").
        if (data.status === 'published' && prevStatus === 'in_review' && req.user) {
          data.editor = req.user.id
          const author = data.author ?? originalDoc?.author
          const authorEmail =
            typeof author === 'object' && author
              ? author.email
              : author
                ? (await req.payload.findByID({ collection: 'users', id: author })).email
                : undefined
          if (authorEmail === SYSTEM_AUTHOR_EMAIL) {
            data.author = req.user.id
          }
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
