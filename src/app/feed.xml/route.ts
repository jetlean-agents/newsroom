import { getPayloadClient } from '@/lib/payload'
import { SITE_URL, SITE_NAME, NOINDEX } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await getPayloadClient()
  const articles = await payload.find({
    collection: 'articles',
    where: { status: { equals: 'published' } },
    sort: '-published_at',
    limit: 30,
  })

  const items = articles.docs.map(
    (a: any) => `<item>
  <title>${escapeXml(a.title)}</title>
  <link>${SITE_URL}/articles/${a.slug}</link>
  <guid>${SITE_URL}/articles/${a.slug}</guid>
  <pubDate>${new Date(a.published_at).toUTCString()}</pubDate>
  <description>${escapeXml(a.lead)}</description>
</item>`,
  )

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${escapeXml(SITE_NAME)}</title>
<link>${SITE_URL}</link>
<description>${escapeXml(SITE_NAME)}</description>
${items.join('\n')}
</channel></rss>`

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml',
      ...(NOINDEX ? { 'X-Robots-Tag': 'noindex' } : {}),
    },
  })
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
