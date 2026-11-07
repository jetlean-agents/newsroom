import { getPayloadClient } from '@/lib/payload'
import type { Source } from '@/payload-types'

const DEFAULT_RUBRIC_SLUG = 'bez-rubryky'
const SYSTEM_AUTHOR_EMAIL = 'ingest-system@sandbox.local'

async function getOrCreateFallbackRubric() {
  const payload = await getPayloadClient()
  const existing = await payload.find({ collection: 'rubrics', where: { slug: { equals: DEFAULT_RUBRIC_SLUG } }, limit: 1 })
  if (existing.docs[0]) return existing.docs[0]
  return payload.create({ collection: 'rubrics', data: { title: 'Без рубрики' } })
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
  })
}

/**
 * Turns a confirmed event into a "draft assignment" (FACT-169 scope item 4):
 * an Article in `draft` status whose body is a facts-with-citations scaffold
 * for a human author to rewrite in their own words — never auto-published,
 * never AI-written prose (AI_PROVIDER stays "none" unless Roman turns it on).
 */
export async function draftFromEvent() {
  const payload = await getPayloadClient()
  const events = await payload.find({
    collection: 'events',
    where: { and: [{ status: { equals: 'new' } }, { independent_confirmation: { equals: true } }] },
    limit: 50,
  })

  let drafted = 0
  for (const event of events.docs) {
    const members = await payload.find({
      collection: 'source-items',
      where: { event: { equals: event.id } },
      sort: 'published_at',
      depth: 1,
      limit: 50,
    })
    if (!members.docs.length) continue

    const rubric = await getOrCreateFallbackRubric()
    const author = await getOrCreateSystemAuthor()

    const sources = members.docs.map((item) => ({
      title: item.title,
      url: item.url,
      publisher: typeof item.source === 'object' ? (item.source as Source).name : undefined,
      accessed_at: item.fetched_at,
    }))

    const factsList = members.docs
      .map((item) => `- ${item.title}${item.summary ? ` — ${item.summary}` : ''} (${sources.find((s) => s.url === item.url)?.publisher ?? 'джерело'})`)
      .join('\n')

    const article = await payload.create({
      collection: 'articles',
      data: {
        title: event.title,
        lead: `[ЧЕРНОВИК-ЗАВДАННЯ] ${event.title}`,
        body: {
          root: {
            type: 'root',
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
            children: [
              {
                type: 'paragraph',
                version: 1,
                children: [{
                  type: 'text',
                  version: 1,
                  text: `Факти з ${sources.length} джерел для самостійного переписування (не копіювати):\n\n${factsList}`,
                }],
              },
            ],
          },
        },
        rubric: rubric.id,
        event: event.id,
        event_date: members.docs[0].published_at || members.docs[0].fetched_at,
        sources,
        status: 'draft',
        author: author.id,
        ai_assisted: false,
      },
    })

    await payload.update({ collection: 'events', id: event.id, data: { status: 'drafted', draft_article: article.id } })
    drafted++
  }

  return { eventsConsidered: events.docs.length, drafted }
}
