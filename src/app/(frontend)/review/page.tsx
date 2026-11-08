import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { prioritizeReviewQueue } from '@/lib/review/priority'
import type { Article, Event, Rubric } from '@/payload-types'
import ReviewQueueClient, { type QueueItem } from './ReviewQueueClient'

export const dynamic = 'force-dynamic'

function eventSourceCount(article: Article): number {
  const event = article.event as Event | number | null | undefined
  return typeof event === 'object' && event ? event.source_count ?? 1 : 1
}

function rubricSlug(article: Article): string | null {
  const rubric = article.rubric as Rubric | number | null | undefined
  return typeof rubric === 'object' && rubric ? rubric.slug ?? null : null
}

function rubricTitle(article: Article): string {
  const rubric = article.rubric as Rubric | number | null | undefined
  return typeof rubric === 'object' && rubric ? rubric.title : 'Без рубрики'
}

function plainTextFromBody(body: Article['body']): string {
  const lines: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { type?: string; text?: string; children?: unknown[] }
    if (n.type === 'text' && n.text) lines.push(n.text)
    n.children?.forEach(walk)
  }
  walk(body?.root)
  return lines.join('\n\n')
}

/**
 * Fast editorial review queue (FACT-236 scope item 5): every `in_review`
 * article with its draft, sources, originality overlap and fact-check flags
 * all on one screen — no tab-switching between the article and its sources
 * the way the generic Payload admin edit view would require. Reachable only
 * by an authenticated editor/admin; everyone else is bounced to /admin to log in.
 */
export default async function ReviewQueuePage() {
  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user || (user.role !== 'editor' && user.role !== 'admin')) {
    redirect('/admin')
  }

  const result = await payload.find({
    collection: 'articles',
    where: { status: { equals: 'in_review' } },
    depth: 2,
    limit: 100,
  })

  const ranked = prioritizeReviewQueue(
    result.docs.map((a) => ({
      id: a.id,
      sourceCount: eventSourceCount(a),
      eventDate: a.event_date,
      rubricSlug: rubricSlug(a),
    })),
  )

  const items: QueueItem[] = ranked.map((r) => {
    const article = result.docs.find((a) => a.id === r.id)!
    return {
      id: article.id,
      title: article.title,
      lead: article.lead,
      bodyText: plainTextFromBody(article.body),
      rubricTitle: rubricTitle(article),
      sourceCount: r.sourceCount,
      eventDate: article.event_date ?? null,
      sources: (article.sources ?? []).map((s) => ({
        title: s.title,
        url: s.url,
        publisher: s.publisher ?? null,
      })),
      originalityOverlap: article.originality_overlap ?? null,
      originalityBlocked: !!article.originality_blocked,
      aiAssisted: !!article.ai_assisted,
      factFlags: (article.fact_flags ?? []).map((f) => ({ value: f.value, kind: f.kind })),
    }
  })

  return <ReviewQueueClient initialQueue={items} />
}
