import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { absoluteUrl, rubricPath } from '@/lib/urls'
import { getRubric } from '@/lib/rubricHub'
import { buildRssFeed, rssResponse } from '@/lib/rss'

export const dynamic = 'force-dynamic'

/** Per-rubric RSS (FACT-340 AC: `/{rubric}/feed.xml`). Static segment, so Next
 * routes it here rather than into `[rubric]/[slug]/page.tsx`. */
export async function GET(_req: Request, { params }: { params: Promise<{ rubric: string }> }) {
  const { rubric } = await params
  const doc = await getRubric(rubric)
  if (!doc) notFound()

  const payload = await getPayloadClient()
  const articles = await payload.find({
    collection: 'articles',
    where: { and: [{ status: { equals: 'published' } }, { rubric: { equals: doc.id } }] },
    sort: '-published_at',
    limit: 30,
    depth: 1,
  })

  const xml = buildRssFeed(articles.docs, {
    title: `${doc.title} — Новини України`,
    link: absoluteUrl(rubricPath(doc.slug!)),
    description: doc.description || doc.title,
  })
  return rssResponse(xml)
}
