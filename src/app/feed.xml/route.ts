import { getPayloadClient } from '@/lib/payload'
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from '@/lib/env'
import { buildRssFeed, rssResponse } from '@/lib/rss'

export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await getPayloadClient()
  const articles = await payload.find({
    collection: 'articles',
    where: { status: { equals: 'published' } },
    sort: '-published_at',
    limit: 30,
    depth: 1,
  })

  const xml = buildRssFeed(articles.docs, { title: SITE_NAME, link: SITE_URL, description: SITE_DESCRIPTION })
  return rssResponse(xml)
}
