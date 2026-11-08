import { getPayloadClient } from '@/lib/payload'
import { getDraftProvider, type DraftFact } from '@/lib/ai/draftProvider'
import { maxOverlap } from '@/lib/ai/originality'
import { factCheckFlags } from '@/lib/ai/factCheck'
import { prioritizeEvents } from '@/lib/review/priority'
import { ORIGINALITY_MAX_OVERLAP, DRAFTS_PER_DAY } from '@/lib/env'
import { SYSTEM_AUTHOR_EMAIL } from '@/lib/ingest/systemAuthor'
import type { Source, Rubric, Tag } from '@/payload-types'

const DEFAULT_RUBRIC_SLUG = 'bez-rubryky'

async function getOrCreateFallbackRubric() {
  const payload = await getPayloadClient()
  const existing = await payload.find({ collection: 'rubrics', where: { slug: { equals: DEFAULT_RUBRIC_SLUG } }, limit: 1 })
  if (existing.docs[0]) return existing.docs[0]
  return payload.create({ collection: 'rubrics', data: { title: 'Без рубрики' }, disableTransaction: true })
}

async function findRubricBySlug(slug: string | undefined): Promise<Rubric | null> {
  if (!slug) return null
  const payload = await getPayloadClient()
  const existing = await payload.find({ collection: 'rubrics', where: { slug: { equals: slug } }, limit: 1 })
  return existing.docs[0] ?? null
}

async function getOrCreateTags(titles: string[] | undefined): Promise<Tag[]> {
  if (!titles?.length) return []
  const payload = await getPayloadClient()
  const tags: Tag[] = []
  for (const title of titles) {
    const existing = await payload.find({ collection: 'tags', where: { title: { equals: title } }, limit: 1 })
    tags.push(existing.docs[0] ?? (await payload.create({ collection: 'tags', data: { title }, disableTransaction: true })))
  }
  return tags
}

async function getOrCreateSystemAuthor() {
  const payload = await getPayloadClient()
  const existing = await payload.find({ collection: 'users', where: { email: { equals: SYSTEM_AUTHOR_EMAIL } }, limit: 1 })
  if (existing.docs[0]) return existing.docs[0]
  return payload.create({
    collection: 'users',
    data: {
      name: 'Ingest (система)',
      email: SYSTEM_AUTHOR_EMAIL,
      password: `sys-${Math.random().toString(36).slice(2)}${Date.now()}`,
      role: 'author',
    },
    disableTransaction: true,
  })
}

function paragraphNode(text: string) {
  return { type: 'paragraph', version: 1, children: [{ type: 'text', version: 1, text }] }
}

function headingNode(text: string) {
  return { type: 'heading', tag: 'h3', version: 1, children: [{ type: 'text', version: 1, text }] }
}

function buildLexicalBody(paragraphs: string[], whatIsKnown: string, whatIsUnknown: string) {
  const children = paragraphs.map(paragraphNode)
  if (whatIsKnown) {
    children.push(headingNode('Що відомо'), paragraphNode(whatIsKnown))
  }
  if (whatIsUnknown) {
    children.push(headingNode('Що невідомо'), paragraphNode(whatIsUnknown))
  }
  return {
    root: {
      type: 'root',
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
      children,
    },
  }
}

async function draftsCreatedToday(): Promise<number> {
  const payload = await getPayloadClient()
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const result = await payload.count({
    collection: 'articles',
    where: { drafted_at: { greater_than_equal: startOfDay.toISOString() } },
  })
  return result.totalDocs
}

/**
 * Turns a confirmed event into a draft Article (FACT-169 scope item 4, extended
 * by FACT-236): the configured DraftProvider (AI_PROVIDER=none|mock|anthropic)
 * writes a UA-language draft from the event's source facts only — never
 * auto-published, never mixing in facts the sources didn't report.
 *
 * Adds (FACT-236):
 * - anti-copypaste: originality_overlap/originality_blocked (src/lib/ai/originality.ts)
 * - fact-check assist: fact_flags (src/lib/ai/factCheck.ts)
 * - queue prioritization: most-sourced, freshest events drafted first
 * - DRAFTS_PER_DAY cap so the review queue can't outgrow editor capacity
 *
 * `disableTransaction: true` on every write below for the same reason as
 * src/seed/index.ts: many sequential Local API calls on one connection can
 * leave it idle-in-transaction across calls and deadlock the next one
 * (Payload 3.37); each write here is already a single all-or-nothing op.
 */
export async function draftFromEvent() {
  const payload = await getPayloadClient()
  const events = await payload.find({
    collection: 'events',
    where: { and: [{ status: { equals: 'new' } }, { independent_confirmation: { equals: true } }] },
    limit: 200,
  })

  const ranked = prioritizeEvents(
    events.docs.map((e) => ({ id: e.id, sourceCount: e.source_count ?? 1, firstSeenAt: e.first_seen_at })),
  )
  const rankedEvents = ranked.map((r) => events.docs.find((e) => e.id === r.id)!)

  const provider = getDraftProvider()
  let budgetRemaining = Math.max(0, DRAFTS_PER_DAY - (await draftsCreatedToday()))

  let drafted = 0
  let skippedBudget = 0
  let skippedError = 0

  for (const event of rankedEvents) {
    if (budgetRemaining <= 0) {
      skippedBudget++
      continue
    }

    const members = await payload.find({
      collection: 'source-items',
      where: { event: { equals: event.id } },
      sort: 'published_at',
      depth: 1,
      limit: 50,
    })
    if (!members.docs.length) continue

    const facts: DraftFact[] = members.docs.map((item) => ({
      title: item.title,
      summary: item.summary,
      url: item.url,
      publisher: typeof item.source === 'object' ? (item.source as Source).name : undefined,
      publishedAt: item.published_at,
    }))

    let draft
    try {
      draft = await provider.generateDraft({ eventTitle: event.title, facts })
    } catch (err) {
      console.error(`[draftFromEvent] provider "${provider.name}" failed for event ${event.id}:`, err)
      skippedError++
      continue
    }

    const rubric = (await findRubricBySlug(draft.suggestedRubricSlug)) ?? (await getOrCreateFallbackRubric())
    const author = await getOrCreateSystemAuthor()
    const tags = await getOrCreateTags(draft.tags)

    const bodyText = [draft.lead, ...draft.paragraphs, draft.whatIsKnown, draft.whatIsUnknown].filter(Boolean).join('\n')
    const sourceTexts = facts.map((f) => `${f.title} ${f.summary ?? ''}`)
    const overlap = draft.aiGenerated ? maxOverlap(bodyText, sourceTexts) : 0
    const originalityBlocked = overlap > ORIGINALITY_MAX_OVERLAP
    const factFlags = draft.aiGenerated ? factCheckFlags(bodyText, sourceTexts) : []

    const sources = facts.map((f) => ({ title: f.title, url: f.url, publisher: f.publisher, accessed_at: f.publishedAt }))

    const article = await payload.create({
      collection: 'articles',
      data: {
        title: draft.title,
        lead: draft.lead,
        body: buildLexicalBody(draft.paragraphs, draft.whatIsKnown, draft.whatIsUnknown),
        rubric: rubric.id,
        tags: tags.map((t) => t.id),
        event: event.id,
        event_date: members.docs[0].published_at || members.docs[0].fetched_at,
        sources,
        status: 'draft',
        author: author.id,
        drafted_at: new Date().toISOString(),
        ai_assisted: draft.aiGenerated,
        ai_disclosure: draft.aiGenerated
          ? 'Цей чернетковий матеріал згенеровано за допомогою AI з фактів нижче і перевірений редактором перед публікацією.'
          : undefined,
        originality_overlap: overlap,
        originality_blocked: originalityBlocked,
        fact_flags: factFlags,
      },
      disableTransaction: true,
    })

    await payload.update({
      collection: 'events',
      id: event.id,
      data: { status: 'drafted', draft_article: article.id },
      disableTransaction: true,
    })
    drafted++
    budgetRemaining--
  }

  return { eventsConsidered: events.docs.length, drafted, skippedBudget, skippedError, provider: provider.name }
}
